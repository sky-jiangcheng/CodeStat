package service

import (
	"context"
	"fmt"
	"log"
	"strconv"
	"time"

	"gitboard/internal/db"
	"gitboard/internal/grouper"
	"gitboard/internal/scanner"
)

// ScanResult holds the result of a scan operation.
type ScanResult struct {
	Success    bool   `json:"success"`
	ReposFound int    `json:"repos_found"`
	Projects   int    `json:"projects"`
	TaskID     string `json:"task_id,omitempty"`
}

// ScanStatus holds the current scanning progress.
type ScanStatus struct {
	Running     bool   `json:"running"`
	Backfilling bool   `json:"backfilling"`
	Message     string `json:"message"`
	Progress    int    `json:"progress"`
	Total       int    `json:"total"`
}

// TriggerScan starts an async full repository scan and returns immediately.
// Only projects marked as collected get their stats refreshed afterwards.
func (s *Service) TriggerScan() (*ScanResult, error) {
	s.scanMu.Lock()
	if s.scanning {
		s.scanMu.Unlock()
		return nil, fmt.Errorf("scan already in progress")
	}

	ctx, cancel := context.WithCancel(context.Background())
	s.scanCancel = cancel
	s.scanning = true
	s.scanMu.Unlock()

	collectedIDs, err := db.GetCollectedProjectIDs(ctx, s.db)
	if err != nil {
		s.scanMu.Lock()
		s.scanning = false
		s.scanCancel = nil
		s.scanMu.Unlock()
		return nil, err
	}

	taskID := fmt.Sprintf("%d", time.Now().UnixNano())

	go func() {
		s.runCollectedScan(ctx, collectedIDs)
		s.scanMu.Lock()
		s.scanning = false
		s.scanProgress = 0
		s.scanTotal = 0
		s.scanCancel = nil
		s.scanMu.Unlock()
	}()

	return &ScanResult{Success: true, TaskID: taskID}, nil
}

// GetScanStatus returns the current scan progress.
func (s *Service) GetScanStatus() *ScanStatus {
	s.scanMu.Lock()
	running := s.scanning
	progress := s.scanProgress
	total := s.scanTotal
	s.scanMu.Unlock()
	msg := ""
	if running {
		if total > 0 {
			msg = fmt.Sprintf("Scanning %d/%d...", progress, total)
		} else {
			msg = "Scanning..."
		}
	}
	return &ScanStatus{Running: running, Message: msg, Progress: progress, Total: total}
}

// runCollectedScan is the single scan pipeline: filesystem scan → grouping →
// transactional sync of projects/repos → stale cleanup → stats refresh for
// collected projects.
func (s *Service) runCollectedScan(ctx context.Context, collectedIDs []int64) {
	defer func() {
		if r := recover(); r != nil {
			log.Printf("panic in collected scan: %v", r)
		}
	}()

	depthStr, _ := db.GetConfig(s.db, "scan_depth")
	maxDepth, _ := strconv.Atoi(depthStr)
	if maxDepth <= 0 || maxDepth > 2 {
		maxDepth = 2
	}

	roots, _ := db.GetScanRoots(s.db)
	repos, err := scanner.ScanRepositories(roots, maxDepth)
	if err != nil {
		log.Printf("scan error: %v", err)
		return
	}

	// Group discovered repositories into projects. Repositories returned by
	// the scanner are filesystem paths without a DB id, so they are all
	// grouped and then synced; collectedIDs is used below to refresh stats
	// only for those.
	groups := grouper.GroupRepositories(repos)

	s.scanMu.Lock()
	s.scanTotal = len(groups)
	s.scanProgress = 0
	s.scanMu.Unlock()

	scannedPaths := make([]string, 0, len(repos))
	for _, r := range repos {
		scannedPaths = append(scannedPaths, r.Path)
	}

	tx, err := s.db.Begin()
	if err != nil {
		log.Printf("scan transaction begin error: %v", err)
		return
	}
	defer tx.Rollback() //nolint:errcheck

	for i, group := range groups {
		select {
		case <-ctx.Done():
			return
		default:
		}
		s.scanMu.Lock()
		s.scanProgress = i + 1
		s.scanMu.Unlock()

		projectID, err := db.SyncProjectTx(tx, group.Name, group.RootPath, 0, group.IsAutoGrouped)
		if err != nil {
			log.Printf("sync project error: %v", err)
			continue
		}
		for _, repo := range group.Repos {
			if err := db.UpsertRepositoryTx(tx, repo.Path, projectID); err != nil {
				log.Printf("upsert repo error: %v", err)
			}
		}
	}

	if err := db.CleanupStaleDataTx(tx, scannedPaths); err != nil {
		log.Printf("cleanup stale data error: %v", err)
		return
	}

	if err := tx.Commit(); err != nil {
		log.Printf("scan transaction commit error: %v", err)
		return
	}

	s.refreshCollectedStats(ctx, collectedIDs)
	_ = db.SetConfig(s.db, "last_stats_backfill", s.git.GetTodayDate())
	log.Printf("scan complete: %d repos, %d projects", len(repos), len(groups))
	if s.rt != nil {
		s.rt.Emit("project.scanned", map[string]any{
			"repos_found": len(repos), "projects": len(groups),
		})
	}
}
