package main

import (
	"database/sql"

	"gitboard/internal/core/git"
	"gitboard/internal/core/kb"
	"gitboard/internal/core/storage"
	"gitboard/internal/core/storage/sqlite"
)

// WireDefaults builds the default production dependencies for a GitBuddy app:
//   - GitProvider: LocalGitProvider (shells out to local git)
//   - Stores:      SQLite adapter wrapping the supplied *sql.DB
//   - KBFacade:    DefaultFacade backed by the above stores
//
// It returns each component separately so callers can pick what they need.
func WireDefaults(rawDB *sql.DB) (git.Provider, storage.Stores, kb.Facade) {
	gp := git.NewLocalGitProvider()
	stores := sqlite.New(rawDB)
	kbFacade := kb.NewFacade(stores)
	return gp, stores, kbFacade
}

// NewAppWithDeps constructs an App using explicitly supplied dependencies.
// Prefer this constructor in tests and in future server-mode builds so that
// dependencies can be swapped (e.g. mock Providers or alternative storage
// backends).
func NewAppWithDeps(database *sql.DB, gitUser string, gp git.Provider, stores storage.Stores, kbf kb.Facade) *App {
	return &App{
		db:      database,
		gitUser: gitUser,
		Git:     gp,
		Stores:  stores,
		KB:      kbf,
	}
}
