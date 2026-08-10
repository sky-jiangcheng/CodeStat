package main

import (
	"context"
	"database/sql"
	"fmt"
	"log"
	"sync"
	"time"

	"gitboard/internal/core/git"
	pluginruntime "gitboard/internal/core/plugin/runtime"
	"gitboard/internal/core/storage"
	"gitboard/internal/db"
	"gitboard/internal/platform"
)

// version is the application version. Overridable at build time via:
//
//	wails build -ldflags "-X main.version=1.5.3"
//
// Kept in sync with wails.json -> info.productVersion by scripts/bump-version.sh.
var version = "1.6.1"

// App is the main application struct whose public methods are exposed to the
// frontend via Wails Bind. The ctx is set during OnStartup.
//
// M1 transition: the app holds both the new abstract dependencies (Git /
// Stores) and the legacy raw *sql.DB handle. New code MUST go through
// the abstract deps; existing code is gradually migrated in subsequent
// milestones.
type App struct {
	ctx            context.Context
	gitUser        string
	scanMu         sync.Mutex
	scanning       bool
	backfilling    bool
	scanCancel     context.CancelFunc
	backfillCancel context.CancelFunc
	scanProgress   int
	scanTotal      int
	currentTask    string // tracks the current scan task ID

	// --- New core abstractions (M1+) ---
	Git    git.Provider
	Stores storage.Stores

	// --- In-process plugin runtime (yaegi scripts + built-in importers) ---
	pluginRuntime *pluginruntime.Runtime

	// --- Legacy handle, kept for transition period only ---
	db *sql.DB

	// Status bar cache to avoid repeated git log queries on every render
	statusCacheMu   sync.Mutex
	statusCache     *StatusBarData
	statusCacheTime time.Time
}

// NewApp creates a new App instance with default production dependencies
// (LocalGitProvider + SQLite stores). Use NewAppWithDeps when
// you need to inject custom implementations (e.g. in tests).
func NewApp(database *sql.DB, gitUser string) *App {
	gp, stores := WireDefaults(database)
	return NewAppWithDeps(database, gitUser, gp, stores)
}

// startup is called at application startup.
func (a *App) startup(ctx context.Context) {
	a.ctx = ctx
	if a.pluginRuntime != nil {
		// Register built-in importers before loading script plugins so both
		// appear in the knowledge-sources list.
		a.registerClaudeImporter()
		// Load plugins so event handlers are registered before the UI binds.
		a.pluginRuntime.Load(platform.GetPluginsDir())
		log.Printf("plugin runtime ready: %d plugin(s), %d source(s)",
			len(a.pluginRuntime.PluginStatuses()), len(a.pluginRuntime.SourceStatuses()))

		// Auto-import knowledge sources on startup (issue #36). Defaults to on;
		// a user can disable it via the auto_import config key.
		if v, err := db.GetConfig(a.db, "auto_import"); err == nil && v != "0" {
			go func() {
				results := a.TriggerAllKnowledgeImports()
				for _, r := range results {
					if r.Err != "" {
						log.Printf("auto-import %q failed: %s", r.Name, r.Err)
					} else {
						log.Printf("auto-import %q: +%d ~%d -%d",
							r.Name, r.Run.Created, r.Run.Updated, r.Run.Skipped)
					}
				}
			}()
		}
	}
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
	repos, err := a.Stores.Repository.GetAll()
	if err != nil {
		return
	}

	startDate := time.Now().AddDate(0, 0, -365).Format("2006-01-02")
	endDate := a.Git.GetTodayDate()

	for _, repo := range repos {
		select {
		case <-ctx.Done():
			log.Printf("stats refresh cancelled")
			return
		default:
		}

		allEntries, err := a.Git.QueryStatsRange(repo.Path, startDate, endDate, "")
		if err == nil && allEntries != nil {
			for _, e := range allEntries {
				if e.FilesChanged > 0 || e.LinesAdded > 0 || e.LinesDeleted > 0 {
					_ = a.Stores.DailyStat.Upsert(repo.ID, e.Date, "all",
						e.FilesChanged, e.LinesAdded, e.LinesDeleted)
				}
			}
		}

		if a.gitUser != "" {
			myEntries, err := a.Git.QueryStatsRange(repo.Path, startDate, endDate, a.gitUser)
			if err == nil && myEntries != nil {
				for _, e := range myEntries {
					if e.FilesChanged > 0 || e.LinesAdded > 0 || e.LinesDeleted > 0 {
						_ = a.Stores.DailyStat.Upsert(repo.ID, e.Date, a.gitUser,
							e.FilesChanged, e.LinesAdded, e.LinesDeleted)
					}
				}
			}
		}
	}
}

// refreshProjectHistory backfills a full year of daily stats for all repos
// belonging to a single project. This is the per-project equivalent of
// refreshAllStatsWithCancel, triggered on demand from the dashboard.
// Respects context cancellation and logs errors encountered during upsert.
func (a *App) refreshProjectHistory(ctx context.Context, projectID int64) error {
	repos, err := a.Stores.Repository.GetByProject(projectID)
	if err != nil {
		return fmt.Errorf("failed to load repos: %w", err)
	}
	if len(repos) == 0 {
		return fmt.Errorf("project has no repositories")
	}

	startDate := time.Now().AddDate(0, 0, -365).Format("2006-01-02")
	endDate := a.Git.GetTodayDate()

	for _, repo := range repos {
		select {
		case <-ctx.Done():
			return ctx.Err()
		default:
		}

		allEntries, err := a.Git.QueryStatsRange(repo.Path, startDate, endDate, "")
		if err != nil {
			log.Printf("refresh history query error (repo %s, all): %v", repo.Path, err)
			continue
		}
		if allEntries != nil {
			for _, e := range allEntries {
				if e.FilesChanged > 0 || e.LinesAdded > 0 || e.LinesDeleted > 0 {
					if err := a.Stores.DailyStat.Upsert(repo.ID, e.Date, "all",
						e.FilesChanged, e.LinesAdded, e.LinesDeleted); err != nil {
						log.Printf("refresh history upsert error (repo %s, %s): %v", repo.Path, e.Date, err)
					}
				}
			}
		}

		if a.gitUser != "" {
			myEntries, err := a.Git.QueryStatsRange(repo.Path, startDate, endDate, a.gitUser)
			if err != nil {
				log.Printf("refresh history query error (repo %s, mine): %v", repo.Path, err)
				continue
			}
			if myEntries != nil {
				for _, e := range myEntries {
					if e.FilesChanged > 0 || e.LinesAdded > 0 || e.LinesDeleted > 0 {
						if err := a.Stores.DailyStat.Upsert(repo.ID, e.Date, a.gitUser,
							e.FilesChanged, e.LinesAdded, e.LinesDeleted); err != nil {
							log.Printf("refresh history upsert error (repo %s, %s, mine): %v", repo.Path, e.Date, err)
						}
					}
				}
			}
		}
		if err := a.Stores.Repository.UpdateLastScanned(repo.ID); err != nil {
			log.Printf("refresh history update last_scanned error (repo %d): %v", repo.ID, err)
		}
	}
	return nil
}
