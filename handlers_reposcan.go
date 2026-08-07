package main

import (
	"log"
	"os"
	"path/filepath"
	"sort"
	"strconv"
	"strings"

	"gitboard/internal/db"
	"gitboard/internal/stats"
)

// RepoScanResult summarizes a repository scan run.
type RepoScanResult struct {
	FoundRepos    int `json:"found_repos"`
	NewRepos      int `json:"new_repos"`
	SkippedHidden int `json:"skipped_hidden"`
}

// ScanForRepositories walks the scan roots on disk looking for .git directories
// and upserts them into the repositories table with author/user info.
func (a *App) ScanForRepositories() (*RepoScanResult, error) {
	result := &RepoScanResult{}
	cfg, err := a.GetConfig()
	if err != nil {
		return nil, err
	}
	if len(cfg.ScanRoots) == 0 {
		return result, nil
	}

	author := cfg.Config["git_author"]
	scanDepth, _ := cfg.Config["scan_depth"]

	existing, err := a.Stores.Repository.GetAll()
	if err != nil {
		return nil, err
	}
	seen := make(map[string]bool, len(existing))
	for _, r := range existing {
		seen[r.Path] = true
	}

	for _, root := range cfg.ScanRoots {
		maxDepth := parseMaxDepth(scanDepth)
		rootDepth := strings.Count(filepath.Clean(root), string(os.PathSeparator))

		_ = filepath.Walk(root, func(path string, info os.FileInfo, walkErr error) error {
			if walkErr != nil || info == nil {
				return nil
			}
			name := info.Name()
			// Skip hidden directories and files (dot-prefixed), except the root.
			if path != root && strings.HasPrefix(name, ".") {
				if info.IsDir() {
					result.SkippedHidden++
					return filepath.SkipDir
				}
				result.SkippedHidden++
				return nil
			}
			// Apply depth limit.
			if info.IsDir() && maxDepth > 0 {
				currentDepth := strings.Count(filepath.Clean(path), string(os.PathSeparator)) - rootDepth
				if currentDepth > maxDepth {
					return filepath.SkipDir
				}
			}
			if !info.IsDir() || name != ".git" {
				return nil
			}
			repoPath := filepath.Dir(path)
			if seen[repoPath] {
				return filepath.SkipDir
			}
			seen[repoPath] = true
			result.FoundRepos++

			meta := stats.InferRepoMeta(repoPath, author)
			displayName := meta.DisplayName
			if displayName == "" {
				displayName = pathBase(repoPath)
			}
			user := author
			if user == "" {
				user = meta.User
			}
			if _, err := a.Stores.Repository.Upsert(repoPath, displayName, user, meta.Organization); err != nil {
				log.Printf("upsert repo %s error: %v", repoPath, err)
			} else {
				result.NewRepos++
			}
			return filepath.SkipDir
		})
	}

	if result.FoundRepos > 0 || result.NewRepos > 0 || len(existing) == 0 {
		if err := a.autoGroupReposIntoProjects(); err != nil {
			log.Printf("auto group repos error: %v", err)
		}
	}
	return result, nil
}

// autoGroupReposIntoProjects groups all unassigned repositories by their parent
// directory name (organization/user) and creates a project per group.
func (a *App) autoGroupReposIntoProjects() error {
	_, err := a.Stores.ScanTxer.AutoGroupUnassigned()
	return err
}

// projectKeyForRepo derives the grouping key for a repo (organization/user or parent dir).
func projectKeyForRepo(r db.Repository) string {
	if r.Organization != nil && *r.Organization != "" {
		return *r.Organization
	}
	if r.GitUser != nil && *r.GitUser != "" {
		return *r.GitUser
	}
	parent := filepath.Dir(r.Path)
	return pathBase(parent)
}

// humanizeProjectName produces a display project name from the grouping key,
// preferring the most common organization/user in the group.
func humanizeProjectName(key string, repos []db.Repository) string {
	counts := make(map[string]int)
	for _, r := range repos {
		if r.Organization != nil && *r.Organization != "" {
			counts[*r.Organization]++
		}
	}
	if len(counts) > 0 {
		var best string
		var bestCount int
		for k, c := range counts {
			if c > bestCount {
				best, bestCount = k, c
			}
		}
		if bestCount >= len(repos)/2 {
			return best
		}
	}
	return key
}

// RefreshStats triggers a full stats refresh for all repositories.
func (a *App) RefreshStats() error {
	return a.RefreshAllStats("")
}

// RefreshProjectStats triggers a stats refresh for all repos under a single project.
func (a *App) RefreshProjectStats(projectID int64) error {
	a.refreshProjectStats(projectID, "")
	return nil
}

// refreshProjectStats refreshes project stats optionally limited to a single date.
func (a *App) refreshProjectStats(projectID int64, date string) {
	repos, err := a.Stores.Repository.GetByProject(projectID)
	if err != nil {
		return
	}
	for _, r := range repos {
		if date != "" {
			// Single-day refresh for the specified date.
			result, qErr := a.Git.QueryStats(r.Path, date, a.gitUser)
			if qErr != nil || result == nil {
				continue
			}
			_ = a.Stores.DailyStat.Upsert(r.ID, date, a.gitUser, result.FilesChanged, result.LinesAdded, result.LinesDeleted)
			continue
		}
		// Full refresh for this repo.
		res, qErr := a.Git.QueryStats(r.Path, "", a.gitUser)
		if qErr != nil || res == nil {
			continue
		}
		_ = a.Stores.DailyStat.Upsert(r.ID, date, a.gitUser, res.FilesChanged, res.LinesAdded, res.LinesDeleted)
	}
}

// RefreshAllStats rebuilds the daily_stats table for all repositories.
func (a *App) RefreshAllStats(_ string) error {
	repos, err := a.Stores.Repository.GetAll()
	if err != nil {
		return err
	}
	sort.Slice(repos, func(i, j int) bool {
		aLast := lastScanTime(repos[i].LastScanned)
		bLast := lastScanTime(repos[j].LastScanned)
		return aLast < bLast
	})
	for _, r := range repos {
		result, err := a.Git.QueryStats(r.Path, "", a.gitUser)
		if err != nil {
			log.Printf("query stats %s error: %v", r.Path, err)
			continue
		}
		if result == nil {
			_ = a.Stores.Repository.UpdateLastScanned(r.ID)
			continue
		}
		_ = a.Stores.DailyStat.Upsert(r.ID, "", a.gitUser, result.FilesChanged, result.LinesAdded, result.LinesDeleted)
		_ = a.Stores.Repository.UpdateLastScanned(r.ID)
	}
	return nil
}

// lastScanTime converts a possibly-null last_scanned string to a comparable
// timestamp string; empty strings sort before any real timestamp.
func lastScanTime(s *string) string {
	if s == nil {
		return ""
	}
	return *s
}

// parseMaxDepth converts the scan_depth config string to an int (1-2, default 2).
func parseMaxDepth(s string) int {
	n, err := strconv.Atoi(s)
	if err != nil || n <= 0 || n > 2 {
		return 2
	}
	return n
}
