// Package storage defines the set of persistence interfaces used by GitBuddy's
// core logic. Call sites depend only on these interfaces, not on any concrete
// database. M1 ships a SQLite adapter (storage/sqlite) that wraps the
// existing internal/db package. PostgreSQL and Elasticsearch adapters are
// planned for M4.
package storage

import (
	"context"

	"gitboard/internal/db"
)

// --- Re-exported domain types ------------------------------------------------
//
// To avoid duplicating struct definitions, we re-use the types defined in
// internal/db. These are plain data carriers; they carry no storage-specific
// semantics and are therefore safe to re-export.

type Project = db.Project
type Repository = db.Repository
type DailyStat = db.DailyStat
type HeatmapDay = db.HeatmapDay
type Todo = db.Todo
type Note = db.Note
type NoteWithProject = db.NoteWithProject
type RepoMeta = db.RepoMeta
type SearchHit = db.SearchHit
type TodoCount = db.TodoCount
type NoteCount = db.NoteCount

// --- Per-domain interfaces ---------------------------------------------------

type ProjectStore interface {
	GetAll() ([]Project, error)
	GetStarred() ([]Project, error)
	GetByID(id int64) (*Project, error)
	Search(query string) ([]Project, error)
	ToggleStar(id int64) (bool, error)
	// Sync inserts or updates a project keyed by rootPath, preserving starred
	// status and respecting auto-grouped immutability. Equivalent to the
	// previous SyncProjectTx but handles the transaction internally.
	Sync(name, rootPath string, levelOverride int, isAutoGrouped bool) (id int64, err error)
	GetCollectedIDs(ctx context.Context) ([]int64, error)
}

type RepositoryStore interface {
	GetAll() ([]Repository, error)
	GetByProject(projectID int64) ([]Repository, error)
	CountByProject(projectID int64) (int64, error)
	// Upsert inserts or updates a repository row keyed by path, optionally
	// attaching display metadata (name, user, organization). It returns the
	// full Repository record with its ID populated.
	Upsert(path, displayName, gitUser, organization string) (*Repository, error)
	// AssignToProject sets the project_id for the given repo IDs, replacing
	// any previously-assigned project for those rows.
	AssignToProject(projectID int64, repoIDs []int64) error
	// GetAllPaths returns every repository path in the table, useful for
	// change detection / cleaning up repos that no longer exist on disk.
	GetAllPaths() ([]string, error)
	UpdateLastScanned(repoID int64) error
}

type DailyStatStore interface {
	Upsert(repoID int64, date, author string, filesChanged, linesAdded, linesDeleted int) error
	GetByProject(projectID int64, date string) ([]DailyStat, error)
	GetByRepository(repoID int64, date string) ([]DailyStat, error)
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
	GetBySourceTitle(projectID int64, source, title string) (*Note, error)
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

type RepoMetaStore interface {
	Get(repoID int64) (*RepoMeta, error)
	// Upsert refreshes the main repo metadata columns (branch, latest commit,
	// remote info, etc.) for a repository.
	Upsert(repoID int64, branch, latestCommitHash, latestCommitTime string, hasRemote bool, remoteURL, firstCommitDate string, sizeBytes int64) error
	// UpdateKnowledge persists top contributors and recent commits (as
	// pre-serialized JSON/text blobs) for a repository. It only writes the
	// knowledge-specific columns; other metadata is preserved.
	UpdateKnowledge(repoID int64, knowledge interface{}) error
}

type ConfigStore interface {
	Get(key string) (string, error)
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
	// SyncProjectRepoAndCleanup runs the full scan-side transaction: it
	// inserts/updates projects and their repos, then deletes any data for
	// repos not present in scannedPaths. It mirrors the behaviour of the
	// legacy code in handlers_scan.go line 158-195.
	//
	// The progress callback is invoked after each group is synced (i, total).
	SyncProjectRepoAndCleanup(
		groups []ProjectGroupInput,
		scannedPaths []string,
		onProgress func(done, total int),
	) error
	// AutoGroupUnassigned runs inside a transaction and groups all repos that
	// currently have NULL project_id. The implementation mirrors the logic
	// in autoGroupReposIntoProjects: group by parent dir / org, create a
	// project per group (or reuse an existing one by name), then assign the
	// repos. It returns how many repos were newly assigned.
	AutoGroupUnassigned() (int, error)
}

// ProjectGroupInput is the flattened input to SyncProjectRepoAndCleanup.
type ProjectGroupInput struct {
	Name          string
	RootPath      string
	LevelOverride int
	IsAutoGrouped bool
	RepoPaths     []string
}

// --- Aggregate container ----------------------------------------------------

// Bundles all domain stores together so the caller receives one object.
type Stores struct {
	Project    ProjectStore
	Repository RepositoryStore
	DailyStat  DailyStatStore
	Note       NoteStore
	Todo       TodoStore
	RepoMeta   RepoMetaStore
	Config     ConfigStore
	ScanRoot   ScanRootStore
	Search     SearchStore
	ScanTxer   ScanTxer
}
