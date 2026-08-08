// Package sqlite is the default storage backend for M1. It implements all
// storage interfaces by thin delegation to the existing internal/db package.
// This strategy keeps 100% of the existing SQL, tests, and migrations while
// giving us the interface seam required for the rest of the refactor.
package sqlite

import (
	"database/sql"
	"log"
	"path/filepath"
	"strings"

	"gitboard/internal/core/storage"
	"gitboard/internal/db"
)

// base holds the shared database handle for all sub-stores.
type base struct {
	raw *sql.DB
}

// Store is the composite that also satisfies ScanTxer (which has no method-name
// conflicts with the per-domain interfaces).
type Store struct {
	base
}

// Compile-time interface checks – catches any drift between the interface and
// the implementation at build time.
var (
	_ storage.RepositoryStore = (*repositoryStore)(nil)
	_ storage.DailyStatStore  = (*dailyStatStore)(nil)
	_ storage.NoteStore       = (*noteStore)(nil)
	_ storage.TodoStore       = (*todoStore)(nil)
	_ storage.ConfigStore     = (*configStore)(nil)
	_ storage.ScanRootStore   = (*scanRootStore)(nil)
	_ storage.SearchStore     = (*searchStore)(nil)
	_ storage.ScanTxer        = (*Store)(nil)
)

// New constructs a SQLite-backed storage.Stores bundle using the supplied
// open database handle. The caller retains ownership of the handle (it is
// not closed by Store.Close) so existing lifecycle code in main.go keeps
// working unchanged.
func New(raw *sql.DB) storage.Stores {
	s := &Store{base{raw: raw}}
	return storage.Stores{
		Repository: &repositoryStore{s.base},
		DailyStat:  &dailyStatStore{s.base},
		Note:       &noteStore{s.base},
		Todo:       &todoStore{s.base},
		Config:     &configStore{s.base},
		ScanRoot:   &scanRootStore{s.base},
		Search:     &searchStore{s.base},
		ScanTxer:   s,
	}
}

// UnderlyingDB returns the raw sql.DB handle. Intended only for the
// transitional bridge code and test setup; future storage backends should
// return nil here.
func (s *Store) UnderlyingDB() *sql.DB { return s.raw }

// ---------------------------------------------------------------------------
// RepositoryStore
// ---------------------------------------------------------------------------

type repositoryStore struct{ base }

func (s *repositoryStore) GetAll() ([]storage.Repository, error) {
	return db.GetAllRepositories(s.raw)
}
func (s *repositoryStore) GetByProject(projectID int64) ([]storage.Repository, error) {
	return db.GetRepositoriesByProjectID(s.raw, projectID)
}
func (s *repositoryStore) Upsert(path, displayName, gitUser, organization string) (*storage.Repository, error) {
	// Step 1: Upsert the path + metadata (last_scanned stays unchanged).
	_, err := s.raw.Exec(`
		INSERT INTO repositories (path, display_name, git_user, organization, last_scanned)
		VALUES (?, ?, ?, ?, NULL)
		ON CONFLICT(path) DO UPDATE SET
			display_name = COALESCE(NULLIF(excluded.display_name, ''), repositories.display_name),
			git_user     = COALESCE(NULLIF(excluded.git_user, ''), repositories.git_user),
			organization = COALESCE(NULLIF(excluded.organization, ''), repositories.organization)
	`, path, displayName, gitUser, organization)
	if err != nil {
		return nil, err
	}
	// Step 2: Read back the row so the caller gets the ID.
	var r storage.Repository
	var projectID sql.NullInt64
	var lastScanned sql.NullString
	err = s.raw.QueryRow(`
		SELECT id, project_id, path, last_scanned
		FROM repositories WHERE path = ?
	`, path).Scan(&r.ID, &projectID, &r.Path, &lastScanned)
	if err != nil {
		return nil, err
	}
	if projectID.Valid {
		pid := projectID.Int64
		r.ProjectID = &pid
	}
	if lastScanned.Valid {
		v := lastScanned.String
		r.LastScanned = &v
	}
	return &r, nil
}
func (s *repositoryStore) AssignToProject(projectID int64, repoIDs []int64) error {
	if len(repoIDs) == 0 {
		return nil
	}
	// Build a single UPDATE with an IN clause using placeholders.
	placeholders := make([]string, len(repoIDs))
	args := make([]interface{}, 0, len(repoIDs)+1)
	args = append(args, projectID)
	for i, id := range repoIDs {
		placeholders[i] = "?"
		args = append(args, id)
	}
	q := `UPDATE repositories SET project_id = ? WHERE id IN (` + strings.Join(placeholders, ",") + `)`
	_, err := s.raw.Exec(q, args...)
	return err
}
func (s *repositoryStore) GetAllPaths() ([]string, error) {
	rows, err := s.raw.Query(`SELECT path FROM repositories`)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var paths []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		paths = append(paths, p)
	}
	return paths, rows.Err()
}
func (s *repositoryStore) UpdateLastScanned(repoID int64) error {
	return db.UpdateRepositoryLastScanned(s.raw, repoID)
}

// ---------------------------------------------------------------------------
// DailyStatStore
// ---------------------------------------------------------------------------

type dailyStatStore struct{ base }

func (s *dailyStatStore) Upsert(repoID int64, date, author string, filesChanged, linesAdded, linesDeleted int) error {
	return db.UpsertDailyStat(s.raw, repoID, date, author, filesChanged, linesAdded, linesDeleted)
}
func (s *dailyStatStore) GetByProject(projectID int64, date string) ([]storage.DailyStat, error) {
	return db.GetStatsByProject(s.raw, projectID, date)
}
func (s *dailyStatStore) GetByDate(date string) ([]storage.DailyStat, error) {
	return db.GetStatsByDate(s.raw, date)
}
func (s *dailyStatStore) GetHeatmap(startDate, endDate, gitUser string) ([]storage.HeatmapDay, error) {
	return db.GetHeatmapData(s.raw, startDate, endDate, gitUser)
}

// ---------------------------------------------------------------------------
// NoteStore
// ---------------------------------------------------------------------------

type noteStore struct{ base }

func (s *noteStore) Create(projectID int64, content string) (*storage.Note, error) {
	return db.CreateNote(s.raw, projectID, content)
}
func (s *noteStore) CreateEx(projectID int64, title, content, tags, kind, source string) (*storage.Note, error) {
	return db.CreateNoteEx(s.raw, projectID, title, content, tags, kind, source)
}
func (s *noteStore) List(projectID int64) ([]storage.Note, error) {
	return db.ListNotes(s.raw, projectID)
}
func (s *noteStore) Update(id int64, content string) error {
	return db.UpdateNote(s.raw, id, content)
}
func (s *noteStore) Delete(id int64) error { return db.DeleteNote(s.raw, id) }
func (s *noteStore) UpdateMeta(id int64, title, tags, kind string, pinned bool) error {
	return db.UpdateNoteMeta(s.raw, id, title, tags, kind, pinned)
}
func (s *noteStore) Pin(id int64, pinned bool) error {
	return db.PinNote(s.raw, id, pinned)
}
func (s *noteStore) ListAllWithProject() ([]storage.NoteWithProject, error) {
	return db.ListAllNotes(s.raw)
}
func (s *noteStore) ListAllTags() ([]string, error)       { return db.ListAllTags(s.raw) }
func (s *noteStore) Counts() ([]storage.NoteCount, error) { return db.GetNoteCounts(s.raw) }

// ---------------------------------------------------------------------------
// TodoStore
// ---------------------------------------------------------------------------

type todoStore struct{ base }

func (s *todoStore) Create(projectID int64, title string) (*storage.Todo, error) {
	return db.CreateTodo(s.raw, projectID, title)
}
func (s *todoStore) List(projectID int64) ([]storage.Todo, error) {
	return db.ListTodos(s.raw, projectID)
}
func (s *todoStore) Toggle(id int64) error                { return db.ToggleTodo(s.raw, id) }
func (s *todoStore) Delete(id int64) error                { return db.DeleteTodo(s.raw, id) }
func (s *todoStore) Reorder(ids []int64) error            { return db.ReorderTodos(s.raw, ids) }
func (s *todoStore) Counts() ([]storage.TodoCount, error) { return db.GetTodoCounts(s.raw) }

// ---------------------------------------------------------------------------
// ConfigStore
// ---------------------------------------------------------------------------

type configStore struct{ base }

func (s *configStore) Set(key, value string) error     { return db.SetConfig(s.raw, key, value) }
func (s *configStore) All() (map[string]string, error) { return db.GetAllConfigs(s.raw) }

// ---------------------------------------------------------------------------
// ScanRootStore
// ---------------------------------------------------------------------------

type scanRootStore struct{ base }

func (s *scanRootStore) Get() ([]string, error)       { return db.GetScanRoots(s.raw) }
func (s *scanRootStore) Replace(roots []string) error { return db.ReplaceScanRoots(s.raw, roots) }

// ---------------------------------------------------------------------------
// SearchStore
// ---------------------------------------------------------------------------

type searchStore struct{ base }

func (s *searchStore) Notes(query string) ([]storage.SearchHit, error) {
	return db.SearchNotes(s.raw, query)
}
func (s *searchStore) All(query string) ([]storage.SearchHit, error) {
	return db.SearchAll(s.raw, query)
}

// ---------------------------------------------------------------------------
// ScanTxer (implemented directly on Store – no method-name conflicts)
// ---------------------------------------------------------------------------

// AutoGroupUnassigned scans every repository with NULL project_id, groups
// them by organization / git_user / parent directory, creates a project for
// each non-trivial group (or reuses an existing one by name), and assigns
// the repos. Returns the number of repositories newly assigned to a project.
func (s *Store) AutoGroupUnassigned() (int, error) {
	tx, err := s.raw.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback() //nolint:errcheck

	rows, err := tx.Query(`
		SELECT id, path, display_name, git_user, organization
		FROM repositories WHERE project_id IS NULL
	`)
	if err != nil {
		return 0, err
	}
	var unassigned []repoForGrouping
	for rows.Next() {
		var r repoForGrouping
		if err := rows.Scan(&r.ID, &r.Path, &r.DisplayName, &r.GitUser, &r.Organization); err != nil {
			rows.Close()
			return 0, err
		}
		unassigned = append(unassigned, r)
	}
	rows.Close()
	if len(unassigned) == 0 {
		return 0, tx.Commit()
	}

	// Group repos by key.
	groups := make(map[string][]repoForGrouping)
	for _, r := range unassigned {
		key := autoGroupKey(r)
		groups[key] = append(groups[key], r)
	}

	assigned := 0
	for key, list := range groups {
		if len(list) == 0 {
			continue
		}
		name := humanizeGroupName(key, list)
		// Get or create project (idempotent: name is the lookup key).
		pid, err := getOrCreateProjectTx(tx, name, "", 0, true)
		if err != nil {
			log.Printf("auto-group get/create project %q error: %v", name, err)
			continue
		}
		// Assign all repos in this group to pid.
		ids := make([]int64, 0, len(list))
		for _, r := range list {
			ids = append(ids, r.ID)
		}
		if err := assignReposToProjectTx(tx, pid, ids); err != nil {
			log.Printf("auto-group assign repos to project %d error: %v", pid, err)
			continue
		}
		assigned += len(ids)
	}
	return assigned, tx.Commit()
}

// repoForGrouping is the working set for auto-grouping unassigned repos.
type repoForGrouping struct {
	ID           int64
	Path         string
	DisplayName  string
	GitUser      sql.NullString
	Organization sql.NullString
}

// autoGroupKey picks the best grouping dimension for a repository.
func autoGroupKey(r repoForGrouping) string {
	if r.Organization.Valid && r.Organization.String != "" {
		return r.Organization.String
	}
	if r.GitUser.Valid && r.GitUser.String != "" {
		return r.GitUser.String
	}
	parent := filepath.Dir(r.Path)
	return filepath.Base(parent)
}

// humanizeGroupName picks the best display name for a group from its members.
func humanizeGroupName(key string, list []repoForGrouping) string {
	counts := make(map[string]int)
	for _, r := range list {
		if r.Organization.Valid && r.Organization.String != "" {
			counts[r.Organization.String]++
		}
	}
	if len(counts) > 0 {
		var best string
		var bestN int
		for k, c := range counts {
			if c > bestN {
				best, bestN = k, c
			}
		}
		if bestN*2 >= len(list) {
			return best
		}
	}
	return key
}

// getOrCreateProjectTx mirrors db.GetOrCreateProjectByName running inside tx.
func getOrCreateProjectTx(tx *sql.Tx, name, rootPath string, levelOverride int, isAutoGrouped bool) (int64, error) {
	var id int64
	err := tx.QueryRow(`SELECT id FROM projects WHERE name = ? LIMIT 1`, name).Scan(&id)
	if err == nil {
		return id, nil
	}
	if err != sql.ErrNoRows {
		return 0, err
	}
	root := rootPath
	auto := 0
	if isAutoGrouped {
		auto = 1
	}
	res, err := tx.Exec(`
		INSERT INTO projects (name, root_path, level_override, is_auto_grouped, starred, created_at)
		VALUES (?, ?, ?, ?, 0, datetime('now'))
	`, name, root, levelOverride, auto)
	if err != nil {
		return 0, err
	}
	return res.LastInsertId()
}

// assignReposToProjectTx sets project_id for a batch of repos inside a tx.
func assignReposToProjectTx(tx *sql.Tx, projectID int64, ids []int64) error {
	if len(ids) == 0 {
		return nil
	}
	ph := make([]string, len(ids))
	args := make([]interface{}, 0, len(ids)+1)
	args = append(args, projectID)
	for i, id := range ids {
		ph[i] = "?"
		args = append(args, id)
	}
	q := `UPDATE repositories SET project_id = ? WHERE id IN (` + strings.Join(ph, ",") + `)`
	_, err := tx.Exec(q, args...)
	return err
}
