// Package storage defines the set of persistence interfaces used by GitBuddy's
// core logic. Call sites depend only on these interfaces, not on any concrete
// database. M1 ships a SQLite adapter (storage/sqlite) that wraps the
// existing internal/db package. PostgreSQL and Elasticsearch adapters are
// planned for M4.
package storage

import (
	"gitboard/internal/db"
)

// --- Re-exported domain types ------------------------------------------------
//
// To avoid duplicating struct definitions, we re-use the types defined in
// internal/db. These are plain data carriers; they carry no storage-specific
// semantics and are therefore safe to re-export.

type Repository = db.Repository
type DailyStat = db.DailyStat
type HeatmapDay = db.HeatmapDay
type Todo = db.Todo
type Note = db.Note
type NoteWithProject = db.NoteWithProject
type SearchHit = db.SearchHit
type TodoCount = db.TodoCount
type NoteCount = db.NoteCount

// --- Per-domain interfaces ---------------------------------------------------

type RepositoryStore interface {
	GetAll() ([]Repository, error)
	GetByProject(projectID int64) ([]Repository, error)
	// Upsert inserts or updates a repository row keyed by path, optionally
	// attaching display metadata (name, user, organization). It returns the
	// full Repository record with its ID populated.
	Upsert(path, displayName, gitUser, organization string) (*Repository, error)
	UpdateLastScanned(repoID int64) error
}

type DailyStatStore interface {
	Upsert(repoID int64, date, author string, filesChanged, linesAdded, linesDeleted int) error
	GetByProject(projectID int64, date string) ([]DailyStat, error)
	GetByDate(date string) ([]DailyStat, error)
	GetHeatmap(startDate, endDate, gitUser string) ([]HeatmapDay, error)
}

type NoteStore interface {
	Create(projectID int64, content string) (*Note, error)
	CreateEx(projectID int64, title, content, tags, kind, source string) (*Note, error)
	List(projectID int64) ([]Note, error)
	Update(id int64, content string) error
	Delete(id int64) error
	UpdateMeta(id int64, title, tags, kind string, pinned bool) error
	Pin(id int64, pinned bool) error
	ListAllWithProject() ([]NoteWithProject, error)
	ListAllTags() ([]string, error)
	Counts() ([]NoteCount, error)
}

type TodoStore interface {
	Create(projectID int64, title string) (*Todo, error)
	List(projectID int64) ([]Todo, error)
	Toggle(id int64) error
	Delete(id int64) error
	Reorder(ids []int64) error
	Counts() ([]TodoCount, error)
}

type ConfigStore interface {
	Set(key, value string) error
	All() (map[string]string, error)
}

type ScanRootStore interface {
	Get() ([]string, error)
	Replace(roots []string) error
}

type SearchStore interface {
	Notes(query string) ([]SearchHit, error)
	All(query string) ([]SearchHit, error)
}

// ScanTxer captures the compound, transactional operations used during the
// scan pipeline. M1's SQLite adapter runs these in a single SQL transaction
// exactly as before; future adapters may map them to native transactional
// primitives (e.g. PG Tx).
type ScanTxer interface {
	// AutoGroupUnassigned runs inside a transaction and groups all repos that
	// currently have NULL project_id. The implementation mirrors the logic
	// in autoGroupReposIntoProjects: group by parent dir / org, create a
	// project per group (or reuse an existing one by name), then assign the
	// repos. It returns how many repos were newly assigned.
	AutoGroupUnassigned() (int, error)
}

// --- Aggregate container ----------------------------------------------------

// Bundles all domain stores together so the caller receives one object.
type Stores struct {
	Repository RepositoryStore
	DailyStat  DailyStatStore
	Note       NoteStore
	Todo       TodoStore
	Config     ConfigStore
	ScanRoot   ScanRootStore
	Search     SearchStore
	ScanTxer   ScanTxer
}
