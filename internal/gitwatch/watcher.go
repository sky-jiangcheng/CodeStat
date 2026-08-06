// Package gitwatch monitors tracked git repositories for new commits by
// polling the modification time of each repo's .git/refs directory. When a
// change is detected, it triggers an incremental stats refresh for that repo
// so the dashboard stays up-to-date without requiring a manual rescan.
//
// This polling approach is intentionally dependency-free (no fsnotify) and
// cross-platform: .git/refs is updated by every git operation that creates
// or moves a commit (push, pull, commit, rebase, merge).
package gitwatch

import (
	"context"
	"database/sql"
	"log"
	"os"
	"path/filepath"
	"sync"
	"time"

	"gitbuddy/internal/db"
	"gitbuddy/internal/stats"
)

// Watcher polls tracked repositories for new commits.
type Watcher struct {
	db       *sql.DB
	gitUser  string
	interval time.Duration
	mu       sync.Mutex
	state    map[int64]time.Time // repo ID -> last seen refs mtime
	cancel   context.CancelFunc
	OnChange func(repoID int64, projectID int64) // optional callback after a refresh
}

// New creates a Watcher. interval defaults to 5 minutes if <= 0.
func New(database *sql.DB, gitUser string, interval time.Duration) *Watcher {
	if interval <= 0 {
		interval = 5 * time.Minute
	}
	return &Watcher{
		db:       database,
		gitUser:  gitUser,
		interval: interval,
		state:    make(map[int64]time.Time),
	}
}

// Start begins polling in a background goroutine until ctx is cancelled.
func (w *Watcher) Start(ctx context.Context) {
	ctx, cancel := context.WithCancel(ctx)
	w.mu.Lock()
	if w.cancel != nil {
		w.cancel()
	}
	w.cancel = cancel
	w.mu.Unlock()

	// Seed the initial state so the first poll does not trigger a refresh
	// for every repo.
	w.seedState()

	go w.loop(ctx)
}

// Stop cancels the polling goroutine.
func (w *Watcher) Stop() {
	w.mu.Lock()
	defer w.mu.Unlock()
	if w.cancel != nil {
		w.cancel()
		w.cancel = nil
	}
}

func (w *Watcher) loop(ctx context.Context) {
	ticker := time.NewTicker(w.interval)
	defer ticker.Stop()

	for {
		select {
		case <-ctx.Done():
			return
		case <-ticker.C:
			w.poll()
		}
	}
}

// seedState records the initial .git/refs mtime for every tracked repo so
// that the first scheduled poll only fires on actual changes.
func (w *Watcher) seedState() {
	repos, err := db.GetAllRepositories(w.db)
	if err != nil {
		return
	}
	w.mu.Lock()
	defer w.mu.Unlock()
	for _, r := range repos {
		w.state[r.ID] = refsMtime(r.Path)
	}
}

// poll checks every tracked repo's .git/refs mtime and triggers an
// incremental stats refresh for repos whose refs have changed since the last
// poll.
func (w *Watcher) poll() {
	repos, err := db.GetAllRepositories(w.db)
	if err != nil {
		log.Printf("gitwatch: failed to load repos: %v", err)
		return
	}

	for _, r := range repos {
		current := refsMtime(r.Path)
		if current.IsZero() {
			continue
		}

		w.mu.Lock()
		last, known := w.state[r.ID]
		w.state[r.ID] = current
		w.mu.Unlock()

		// New repo or unchanged mtime -> skip.
		if !known || !current.After(last) {
			continue
		}

		log.Printf("gitwatch: change detected in %s, refreshing stats", r.Path)
		var pid int64
		if r.ProjectID != nil {
			pid = *r.ProjectID
		}
		w.refreshRepo(r.ID, pid, r.Path)
		if w.OnChange != nil {
			w.OnChange(r.ID, pid)
		}
	}
}

// refreshRepo runs an incremental stats refresh for a single repo: today's
// stats for both "all" and the configured git user.
func (w *Watcher) refreshRepo(repoID int64, projectID int64, repoPath string) {
	today := stats.GetTodayDate()

	allResult, err := stats.QueryStats(repoPath, today, "")
	if err == nil {
		_ = db.UpsertDailyStat(w.db, repoID, today, "all",
			allResult.FilesChanged, allResult.LinesAdded, allResult.LinesDeleted)
	}

	if w.gitUser != "" {
		myResult, err := stats.QueryStats(repoPath, today, w.gitUser)
		if err == nil {
			_ = db.UpsertDailyStat(w.db, repoID, today, w.gitUser,
				myResult.FilesChanged, myResult.LinesAdded, myResult.LinesDeleted)
		}
	}

	_ = db.UpdateRepositoryLastScanned(w.db, repoID)
}

// refsMtime returns the latest modification time of a repo's .git/refs
// directory tree. Returns zero time if the path is inaccessible.
func refsMtime(repoPath string) time.Time {
	refsDir := filepath.Join(repoPath, ".git", "refs")
	info, err := os.Stat(refsDir)
	if err != nil {
		return time.Time{}
	}
	return info.ModTime()
}
