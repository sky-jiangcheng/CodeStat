// Package service contains GitBuddy's business logic: project aggregation,
// the repository scan pipeline, stats refresh, knowledge notes, search and
// AI-facing exports. It is the single layer that talks to the database
// (internal/db) and the git provider (internal/core/git); the Wails binding
// layer (internal/app), the CLI (cmd/gitboard) and the MCP server (cmd/mcp)
// are thin adapters over it and share one implementation.
package service

import (
	"context"
	"database/sql"
	"log"
	"sync"
	"time"

	"gitboard/internal/core/git"
	pluginruntime "gitboard/internal/core/plugin/runtime"
	"gitboard/internal/db"
	"gitboard/internal/version"
)

// ImportEventPayload is the data broadcast after a knowledge-source import.
type ImportEventPayload map[string]any

// Service carries all GitBuddy business logic and its runtime state (scan
// progress, status-bar cache). It is safe for concurrent use.
type Service struct {
	db    *sql.DB
	git   git.Provider
	rt    *pluginruntime.Runtime
	guser string // git user.name used to split "mine" vs "all" stats

	// onImportEvent, when set, is invoked with the import.completed payload
	// after every knowledge import so the UI layer can forward it to the
	// frontend (Wails events, CLI output, ...).
	onImportEvent func(ImportEventPayload)

	// startupOnce guards Startup so double invocation (e.g. the lifecycle
	// hook being called again) never re-registers importers or re-triggers
	// the auto import.
	startupOnce sync.Once

	// Scan engine state, guarded by scanMu.
	scanMu         sync.Mutex
	scanning       bool
	scanBackfilling bool
	scanCancel     context.CancelFunc
	scanProgress   int
	scanTotal      int

	// Status bar cache to avoid repeated git log queries on every render.
	statusCacheMu   sync.Mutex
	statusCache     *StatusBarData
	statusCacheTime time.Time

	// miningInFlight tracks repoIDs currently being mined to prevent duplicate
	// goroutines when the user rapidly switches between projects.
	miningInFlight sync.Map

	// gitUserMu guards guser so the git_author config key can be applied at
	// runtime instead of only at construction time.
	gitUserMu sync.RWMutex
}

// New creates a Service with production dependencies: the local git CLI
// provider and the yaegi plugin runtime over the given database.
func New(database *sql.DB, gitUser string) *Service {
	return NewWithDeps(database, git.NewLocalGitProvider(), pluginruntime.New(database), gitUser)
}

// NewWithDeps constructs a Service with explicitly supplied dependencies
// (used by tests and future alternative providers).
func NewWithDeps(database *sql.DB, provider git.Provider, runtime *pluginruntime.Runtime, gitUser string) *Service {
	return &Service{db: database, git: provider, rt: runtime, guser: gitUser}
}

// gitUser returns the current "mine" author. Reads are guarded so the value
// can be changed at runtime via the git_author config key.
func (s *Service) gitUser() string {
	s.gitUserMu.RLock()
	defer s.gitUserMu.RUnlock()
	return s.guser
}

// setGitUser updates the "mine" author used to split personal vs team stats.
func (s *Service) setGitUser(v string) {
	s.gitUserMu.Lock()
	defer s.gitUserMu.Unlock()
	s.guser = v
}

// SetImportEventHandler installs the callback invoked with the
// import.completed payload after every knowledge import.
func (s *Service) SetImportEventHandler(fn func(ImportEventPayload)) {
	s.onImportEvent = fn
}

// Startup performs one-time initialisation: registers the built-in knowledge
// importers, loads script plugins and kicks off the (optional) auto import.
// Safe to call multiple times; only the first call has an effect.
func (s *Service) Startup() {
	s.startupOnce.Do(func() {
		if s.rt == nil {
			return
		}
		// Load script plugins first, then register the built-in importers:
		// Runtime.Load resets the source map, so registering before it would
		// silently drop the built-in Claude memory importer.
		s.rt.Load(pluginsDir())
		s.registerClaudeImporter()
		log.Printf("plugin runtime ready: %d plugin(s), %d source(s)",
			len(s.rt.PluginStatuses()), len(s.rt.SourceStatuses()))

		// Auto-import knowledge sources on startup (issue #36). Defaults to
		// on; a user can disable it via the auto_import config key.
		if v, err := db.GetConfig(s.db, "auto_import"); err == nil && v != "0" {
			go func() {
				for _, r := range s.TriggerAllKnowledgeImports() {
					if r.Err != "" {
						log.Printf("auto-import %q failed: %s", r.Name, r.Err)
					} else {
						log.Printf("auto-import %q: +%d ~%d -%d",
							r.Name, r.Run.Created, r.Run.Updated, r.Run.Skipped)
					}
				}
			}()
		}
	})
}

// Shutdown cancels any running scan.
func (s *Service) Shutdown() {
	s.scanMu.Lock()
	if s.scanCancel != nil {
		s.scanCancel()
	}
	s.scanMu.Unlock()
}

// Health returns a health-check payload.
func (s *Service) Health() map[string]any {
	if err := s.db.Ping(); err != nil {
		return map[string]any{"status": "error", "message": "database unavailable"}
	}
	return map[string]any{"status": "ok", "version": version.Version}
}

// Close releases the underlying database handle.
func (s *Service) Close() error {
	if s.db != nil {
		return s.db.Close()
	}
	return nil
}
