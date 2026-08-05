package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	"gitboard/internal/db"
	"gitboard/internal/stats"
)

// version is the application version. Overridable at build time via:
//   wails build -ldflags "-X main.version=1.5.3"
// Kept in sync with wails.json -> info.productVersion by scripts/bump-version.sh.
var version = "1.6.3"

// App is the main application struct whose public methods are exposed to the
// frontend via Wails Bind. The ctx is set during OnStartup.
type App struct {
	ctx             context.Context
	db              *sql.DB
	gitUser         string
	scanMu          sync.Mutex
	scanning        bool
	backfilling     bool
	scanCancel      context.CancelFunc
	backfillCancel  context.CancelFunc
	scanProgress    int
	scanTotal       int
	currentTask     string // tracks the current scan task ID

	// Status bar cache to avoid repeated git log queries on every render
	statusCacheMu   sync.Mutex
	statusCache      *StatusBarData
	statusCacheTime  time.Time
}

// NewApp creates a new App instance with dependencies injected.
func NewApp(database *sql.DB, gitUser string) *App {
	return &App{
		db:      database,
		gitUser: gitUser,
	}
}

// startup is called at application startup.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
}

// shutdown is called when the application exits.
func (a *App) shutdown(ctx context.Context) {
	a.scanMu.Lock()
	if a.scanCancel != nil {
		a.scanCancel()
	}
	if a.backfillCancel != nil {
		a.backfillCancel()
	}
	a.scanMu.Unlock()
	if a.db != nil {
		a.db.Close()
	}
}

// Health returns a health-check payload for the frontend.
func (a *App) Health() map[string]interface{} {
	if err := a.db.Ping(); err != nil {
		return map[string]interface{}{"status": "error", "message": "database unavailable"}
	}
	return map[string]interface{}{"status": "ok", "version": version}
}

// refreshAllStatsWithCancel refreshes stats for all repos, respecting cancellation.
func (a *App) refreshAllStatsWithCancel(ctx context.Context) {
	repos, err := db.GetAllRepositories(a.db)
	if err != nil {
		return
	}

	startDate := time.Now().AddDate(0, 0, -365).Format("2006-01-02")
	endDate := stats.GetTodayDate()

	for _, repo := range repos {
		select {
		case <-ctx.Done():
			log.Printf("stats refresh cancelled")
			return
		default:
		}

		allEntries, err := stats.QueryStatsRange(repo.Path, startDate, endDate, "")
		if err == nil && allEntries != nil {
			for _, e := range allEntries {
				if e.FilesChanged > 0 || e.LinesAdded > 0 || e.LinesDeleted > 0 {
					_ = db.UpsertDailyStat(a.db, repo.ID, e.Date, "all",
						e.FilesChanged, e.LinesAdded, e.LinesDeleted)
				}
			}
		}

		if a.gitUser != "" {
			myEntries, err := stats.QueryStatsRange(repo.Path, startDate, endDate, a.gitUser)
			if err == nil && myEntries != nil {
				for _, e := range myEntries {
					if e.FilesChanged > 0 || e.LinesAdded > 0 || e.LinesDeleted > 0 {
						_ = db.UpsertDailyStat(a.db, repo.ID, e.Date, a.gitUser,
							e.FilesChanged, e.LinesAdded, e.LinesDeleted)
					}
				}
			}
		}
	}
}

// refreshProjectStats refreshes stats for all repos in a single project.
func (a *App) refreshProjectStats(projectID int64, date string) {
	repos, err := db.GetRepositoriesByProjectID(a.db, projectID)
	if err != nil {
		return
	}
	for _, repo := range repos {
		allResult, err := stats.QueryStats(repo.Path, date, "")
		if err != nil {
			continue
		}
		if err := db.UpsertDailyStat(a.db, repo.ID, date, "all",
			allResult.FilesChanged, allResult.LinesAdded, allResult.LinesDeleted); err != nil {
			log.Printf("upsert daily stat error: %v", err)
		}
		if a.gitUser != "" {
			myResult, err := stats.QueryStats(repo.Path, date, a.gitUser)
			if err != nil {
				continue
			}
			if err := db.UpsertDailyStat(a.db, repo.ID, date, a.gitUser,
				myResult.FilesChanged, myResult.LinesAdded, myResult.LinesDeleted); err != nil {
				log.Printf("upsert daily stat error: %v", err)
			}
		}
	}
}

// refreshProjectHistory backfills a full year of daily stats for all repos
// belonging to a single project. This is the per-project equivalent of
// refreshAllStatsWithCancel, triggered on demand from the dashboard.
// Respects context cancellation and logs errors encountered during upsert.
func (a *App) refreshProjectHistory(ctx context.Context, projectID int64) error {
	repos, err := db.GetRepositoriesByProjectID(a.db, projectID)
	if err != nil {
		return fmt.Errorf("failed to load repos: %w", err)
	}
	if len(repos) == 0 {
		return fmt.Errorf("project has no repositories")
	}

	startDate := time.Now().AddDate(0, 0, -365).Format("2006-01-02")
	endDate := stats.GetTodayDate()

	for _, repo := range repos {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		allEntries, err := stats.QueryStatsRange(repo.Path, startDate, endDate, "")
		if err != nil {
			log.Printf("refresh history query error (repo %s, all): %v", repo.Path, err)
			continue
		}
		if allEntries != nil {
			for _, e := range allEntries {
				if e.FilesChanged > 0 || e.LinesAdded > 0 || e.LinesDeleted > 0 {
					if err := db.UpsertDailyStat(a.db, repo.ID, e.Date, "all",
						e.FilesChanged, e.LinesAdded, e.LinesDeleted); err != nil {
						log.Printf("refresh history upsert error (repo %s, %s): %v", repo.Path, e.Date, err)
					}
				}
			}
		}

		if a.gitUser != "" {
			myEntries, err := stats.QueryStatsRange(repo.Path, startDate, endDate, a.gitUser)
			if err != nil {
				log.Printf("refresh history query error (repo %s, mine): %v", repo.Path, err)
				continue
			}
			if myEntries != nil {
				for _, e := range myEntries {
					if e.FilesChanged > 0 || e.LinesAdded > 0 || e.LinesDeleted > 0 {
						if err := db.UpsertDailyStat(a.db, repo.ID, e.Date, a.gitUser,
							e.FilesChanged, e.LinesAdded, e.LinesDeleted); err != nil {
							log.Printf("refresh history upsert error (repo %s, %s, mine): %v", repo.Path, e.Date, err)
						}
					}
				}
			}
		}
		if err := db.UpdateRepositoryLastScanned(a.db, repo.ID); err != nil {
			log.Printf("refresh history update last_scanned error (repo %d): %v", repo.ID, err)
		}
	}
	return nil
}
