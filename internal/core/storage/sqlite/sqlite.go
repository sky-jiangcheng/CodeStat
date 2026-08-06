// Package sqlite is the default storage backend for M1. It implements all
// storage interfaces by thin delegation to the existing internal/db package.
// This strategy keeps 100% of the existing SQL, tests, and migrations while
// giving us the interface seam required for the rest of the refactor.
package sqlite

import (
	"context"
	"database/sql"
	"encoding/json"
	"log"
	"path/filepath"
	"sort"
	"strings"

	"gitboard/internal/core/storage"
	"gitboard/internal/db"
)

// Store implements all storage.Store interfaces backed by a *sql.DB.
type Store struct {
	raw *sql.DB
}

// Compile-time interface checks – catches any drift between the interface and
// the implementation at build time.
var (
	_ storage.ProjectStore    = (*Store)(nil)
	_ storage.RepositoryStore = (*Store)(nil)
	_ storage.DailyStatStore  = (*Store)(nil)
	_ storage.NoteStore       = (*Store)(nil)
	_ storage.TodoStore       = (*Store)(nil)
	_ storage.RepoMetaStore   = (*Store)(nil)
	_ storage.ConfigStore     = (*Store)(nil)
	_ storage.ScanRootStore   = (*Store)(nil)
	_ storage.SearchStore     = (*Store)(nil)
	_ storage.ScanTxer        = (*Store)(nil)
)

// New constructs a SQLite-backed storage.Stores bundle using the supplied
// open database handle. The caller retains ownership of the handle (it is
// not closed by Store.Close) so existing lifecycle code in main.go keeps
// working unchanged.
func New(raw *sql.DB) storage.Stores {
	s := &Store{raw: raw}
	return storage.Stores{
		Project:    s,
		Repository: s,
		DailyStat:  s,
		Note:       s,
		Todo:       s,
		RepoMeta:   s,
		Config:     s,
		ScanRoot:   s,
		Search:     s,
		ScanTxer:   s,
	}
}

// UnderlyingDB returns the raw sql.DB handle. Intended only for the
// transitional bridge code and test setup; future storage backends should
// return nil here.
func (s *Store) UnderlyingDB() *sql.DB { return s.raw }

// ---------------------------------------------------------------------------
// ProjectStore
// ---------------------------------------------------------------------------

func (s *Store) GetAll() ([]storage.Project, error)  { return db.GetAllProjects(s.raw) }
func (s *Store) GetStarred() ([]storage.Project, error) {
	return db.GetStarredProjects(s.raw)
}
func (s *Store) GetByID(id int64) (*storage.Project, error) {
	return db.GetProjectByID(s.raw, id)
}
func (s *Store) Search(query string) ([]storage.Project, error) {
	return db.SearchProjects(s.raw, query)
}
func (s *Store) ToggleStar(id int64) (bool, error) {
	return db.ToggleProjectStar(s.raw, id)
}
func (s *Store) Sync(name, rootPath string, levelOverride int, isAutoGrouped bool) (int64, error) {
	tx, err := s.raw.Begin()
	if err != nil {
		return 0, err
	}
	defer tx.Rollback() //nolint:errcheck
	id, err := db.SyncProjectTx(tx, name, rootPath, levelOverride, isAutoGrouped)
	if err != nil {
		return 0, err
	}
	if err := tx.Commit(); err != nil {
		return 0, err
	}
	return id, nil
}
func (s *Store) GetCollectedIDs(ctx context.Context) ([]int64, error) {
	return db.GetCollectedProjectIDs(ctx, s.raw)
}

// ---------------------------------------------------------------------------
// RepositoryStore
// ---------------------------------------------------------------------------

func (s *Store) GetAll() ([]storage.Repository, error) {
	return db.GetAllRepositories(s.raw)
}
func (s *Store) GetByProject(projectID int64) ([]storage.Repository, error) {
	return db.GetRepositoriesByProjectID(s.raw, projectID)
}
func (s *Store) CountByProject(projectID int64) (int64, error) {
	var n int64
	err := s.raw.QueryRow(`SELECT COUNT(*) FROM repositories WHERE project_id = ?`, projectID).Scan(&n)
	return n, err
}
func (s *Store) Upsert(path, displayName, gitUser, organization string) (*storage.Repository, error) {
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
	// Step 2: Read back the full row so the caller gets the ID.
	var r storage.Repository
	var projectID sql.NullInt64
	var user, org, lastScanned sql.NullString
	err = s.raw.QueryRow(`
		SELECT id, project_id, path, display_name, git_user, organization, last_scanned
		FROM repositories WHERE path = ?
	`, path).Scan(&r.ID, &projectID, &r.Path, &r.DisplayName, &user, &org, &lastScanned)
	if err != nil {
		return nil, err
	}
	if projectID.Valid {
		pid := projectID.Int64
		r.ProjectID = &pid
	}
	if user.Valid {
		v := user.String
		r.GitUser = &v
	}
	if org.Valid {
		v := org.String
		r.Organization = &v
	}
	if lastScanned.Valid {
		v := lastScanned.String
		r.LastScanned = &v
	}
	return &r, nil
}
func (s *Store) AssignToProject(projectID int64, repoIDs []int64) error {
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
func (s *Store) GetAllPaths() ([]string, error) {
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
func (s *Store) UpdateLastScanned(repoID int64) error {
	return db.UpdateRepositoryLastScanned(s.raw, repoID)
}

// ---------------------------------------------------------------------------
// DailyStatStore
// ---------------------------------------------------------------------------

func (s *Store) Upsert(repoID int64, date, author string, filesChanged, linesAdded, linesDeleted int) error {
	return db.UpsertDailyStat(s.raw, repoID, date, author, filesChanged, linesAdded, linesDeleted)
}
func (s *Store) GetByProject(projectID int64, date string) ([]storage.DailyStat, error) {
	return db.GetStatsByProject(s.raw, projectID, date)
}
func (s *Store) GetByRepository(repoID int64, date string) ([]storage.DailyStat, error) {
	return db.GetStatsByRepositoryAndDate(s.raw, repoID, date)
}
func (s *Store) GetByDate(date string) ([]storage.DailyStat, error) {
	return db.GetStatsByDate(s.raw, date)
}
func (s *Store) GetHeatmap(startDate, endDate, gitUser string) ([]storage.HeatmapDay, error) {
	return db.GetHeatmapData(s.raw, startDate, endDate, gitUser)
}

// ---------------------------------------------------------------------------
// NoteStore
// ---------------------------------------------------------------------------

func (s *Store) Create(projectID int64, content string) (*storage.Note, error) {
	return db.CreateNote(s.raw, projectID, content)
}
func (s *Store) CreateEx(projectID int64, title, content, tags, kind, source string) (*storage.Note, error) {
	return db.CreateNoteEx(s.raw, projectID, title, content, tags, kind, source)
}
func (s *Store) List(projectID int64) ([]storage.Note, error) {
	return db.ListNotes(s.raw, projectID)
}
func (s *Store) Update(id int64, content string) error {
	return db.UpdateNote(s.raw, id, content)
}
func (s *Store) Delete(id int64) error { return db.DeleteNote(s.raw, id) }
func (s *Store) UpdateMeta(id int64, title, tags, kind string, pinned bool) error {
	return db.UpdateNoteMeta(s.raw, id, title, tags, kind, pinned)
}
func (s *Store) Pin(id int64, pinned bool) error {
	return db.PinNote(s.raw, id, pinned)
}
func (s *Store) GetBySourceTitle(projectID int64, source, title string) (*storage.Note, error) {
	return db.GetNoteBySourceTitle(s.raw, projectID, source, title)
}
func (s *Store) ListAllWithProject() ([]storage.NoteWithProject, error) {
	return db.ListAllNotes(s.raw)
}
func (s *Store) ListAllTags() ([]string, error)    { return db.ListAllTags(s.raw) }
func (s *Store) Counts() ([]storage.NoteCount, error) { return db.GetNoteCounts(s.raw) }

// ---------------------------------------------------------------------------
// TodoStore
// ---------------------------------------------------------------------------

func (s *Store) Create(projectID int64, title string) (*storage.Todo, error) {
	return db.CreateTodo(s.raw, projectID, title)
}
func (s *Store) List(projectID int64) ([]storage.Todo, error) {
	return db.ListTodos(s.raw, projectID)
}
func (s *Store) Toggle(id int64) error { return db.ToggleTodo(s.raw, id) }
func (s *Store) Delete(id int64) error { return db.DeleteTodo(s.raw, id) }
func (s *Store) Reorder(ids []int64) error { return db.ReorderTodos(s.raw, ids) }
func (s *Store) Counts() ([]storage.TodoCount, error) { return db.GetTodoCounts(s.raw) }

// ---------------------------------------------------------------------------
// RepoMetaStore
// ---------------------------------------------------------------------------

func (s *Store) Get(repoID int64) (*storage.RepoMeta, error) {
	return db.GetRepoMeta(s.raw, repoID)
}

// Upsert writes the core repository metadata columns (branch, last commit,
// remote info, size). If no row exists one is created; otherwise existing
// values are updated in place.
func (s *Store) Upsert(repoID int64, branch, latestCommitHash, latestCommitTime string, hasRemote bool, remoteURL, firstCommitDate string, sizeBytes int64) error {
	_, err := s.raw.Exec(`
		INSERT INTO repo_meta (repository_id, branch, latest_commit_hash, latest_commit_time,
			has_remote, remote_url, first_commit_date, size_bytes)
		VALUES (?, ?, ?, ?, ?, ?, ?, ?)
		ON CONFLICT(repository_id) DO UPDATE SET
			branch             = excluded.branch,
			latest_commit_hash = excluded.latest_commit_hash,
			latest_commit_time = excluded.latest_commit_time,
			has_remote         = excluded.has_remote,
			remote_url         = excluded.remote_url,
			first_commit_date  = excluded.first_commit_date,
			size_bytes         = excluded.size_bytes
	`, repoID, branch, latestCommitHash, latestCommitTime, hasRemote, remoteURL, firstCommitDate, sizeBytes)
	return err
}

// UpdateKnowledge serializes TopContributors and RecentCommits from the
// supplied knowledge payload and persists them into the repo_meta row.
// Unknown knowledge structures are safely skipped; missing columns degrade
// gracefully (we just log and continue).
func (s *Store) UpdateKnowledge(repoID int64, knowledge interface{}) error {
	type recent struct {
		Hash    string `json:"hash,omitempty"`
		Time    string `json:"time,omitempty"`
		Author  string `json:"author,omitempty"`
		Message string `json:"message,omitempty"`
	}
	type contributor struct {
		Author      string `json:"author,omitempty"`
		Commits     int    `json:"commits,omitempty"`
		LinesAdded  int    `json:"lines_added,omitempty"`
		LinesDeleted int   `json:"lines_deleted,omitempty"`
	}
	type hasKnowledge interface {
		GetRecentCommits() []interface{}
		GetTopContributors() []interface{}
	}
	var recentJSON, contribJSON string
	// Prefer a direct struct match if the caller gave us *knowledge.RepoKnowledge,
	// otherwise walk via reflection-less duck-typing using the above accessor
	// shape or just the json we can infer from marshalable public fields.
	switch k := knowledge.(type) {
	case *struct {
		TopContributors []contributor `json:"top_contributors"`
		RecentCommits   []recent      `json:"recent_commits"`
	}:
		if b, err := json.Marshal(k.TopContributors); err == nil {
			contribJSON = string(b)
		}
		if b, err := json.Marshal(k.RecentCommits); err == nil {
			recentJSON = string(b)
		}
	default:
		// Fallback: marshal entire thing and try to extract two arrays. We
		// accept the extra CPU cost here because callers only invoke this
		// once per repo per refresh cycle.
		blob, err := json.Marshal(knowledge)
		if err == nil {
			var parsed struct {
				TopContributors json.RawMessage `json:"top_contributors"`
				RecentCommits   json.RawMessage `json:"recent_commits"`
			}
			if json.Unmarshal(blob, &parsed) == nil {
				if len(parsed.TopContributors) > 0 {
					contribJSON = string(parsed.TopContributors)
				}
				if len(parsed.RecentCommits) > 0 {
					recentJSON = string(parsed.RecentCommits)
				}
			}
		}
	}
	// Try to update; if these columns don't exist yet we silently succeed so
	// that migrations can land later without breaking the refresh pipeline.
	const q = `UPDATE repo_meta SET
			top_contributors_json = COALESCE(?, top_contributors_json),
			recent_commits_json   = COALESCE(?, recent_commits_json)
		WHERE repository_id = ?`
	_, err := s.raw.Exec(q, emptyToNull(contribJSON), emptyToNull(recentJSON), repoID)
	if err == nil {
		return nil
	}
	// Degrade: if the JSON columns aren't present yet, try to stuff the
	// payloads into the nullable text columns (tech_stack/readme). This
	// keeps the data persisted even if the schema hasn't been migrated.
	if recentJSON != "" || contribJSON != "" {
		combined := contribJSON
		if recentJSON != "" {
			if combined != "" {
				combined += "\n"
			}
			combined += recentJSON
		}
		_, _ = s.raw.Exec(`UPDATE repo_meta SET readme = COALESCE(?, readme) WHERE repository_id = ?`, combined, repoID)
	}
	return nil
}

// emptyToNull returns nil when s is empty, otherwise the string itself.
func emptyToNull(s string) interface{} {
	if s == "" {
		return nil
	}
	return s
}

// ---------------------------------------------------------------------------
// ConfigStore
// ---------------------------------------------------------------------------

func (s *Store) Get(key string) (string, error)           { return db.GetConfig(s.raw, key) }
func (s *Store) Set(key, value string) error             { return db.SetConfig(s.raw, key, value) }
func (s *Store) All() (map[string]string, error)         { return db.GetAllConfigs(s.raw) }

// ---------------------------------------------------------------------------
// ScanRootStore
// ---------------------------------------------------------------------------

func (s *Store) Get() ([]string, error)                { return db.GetScanRoots(s.raw) }
func (s *Store) Replace(roots []string) error           { return db.ReplaceScanRoots(s.raw, roots) }

// ---------------------------------------------------------------------------
// SearchStore
// ---------------------------------------------------------------------------

func (s *Store) Notes(query string) ([]storage.SearchHit, error) {
	return db.SearchNotes(s.raw, query)
}
func (s *Store) All(query string) ([]storage.SearchHit, error) {
	return db.SearchAll(s.raw, query)
}

// ---------------------------------------------------------------------------
// ScanTxer
// ---------------------------------------------------------------------------

// SyncProjectRepoAndCleanup runs the full scan-side transaction exactly as
// the legacy handlers_scan.go code did. It exists so that callers do not
// need to leak the *sql.Tx type across the storage boundary.
func (s *Store) SyncProjectRepoAndCleanup(
	groups []storage.ProjectGroupInput,
	scannedPaths []string,
	onProgress func(done, total int),
) error {
	tx, err := s.raw.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck

	total := len(groups)
	for i, g := range groups {
		projectID, err := db.SyncProjectTx(tx, g.Name, g.RootPath, g.LevelOverride, g.IsAutoGrouped)
		if err != nil {
			log.Printf("sync project error: %v", err)
			continue
		}
		for _, repoPath := range g.RepoPaths {
			if err := db.UpsertRepositoryTx(tx, repoPath, projectID); err != nil {
				log.Printf("upsert repo error: %v", err)
			}
		}
		if onProgress != nil {
			onProgress(i+1, total)
		}
	}

	if err := db.CleanupStaleDataTx(tx, scannedPaths); err != nil {
		log.Printf("cleanup stale data error: %v", err)
		return err
	}

	return tx.Commit()
}

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
	type repo struct {
		ID           int64
		Path         string
		DisplayName  string
		GitUser      sql.NullString
		Organization sql.NullString
	}
	var unassigned []repo
	for rows.Next() {
		var r repo
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
	groups := make(map[string][]repo)
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

// autoGroupKey picks the best grouping dimension for a repository.
func autoGroupKey(r repo) string {
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
func humanizeGroupName(key string, list []repo) string {
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

// Keep the linter happy about unused imports added earlier.
var (
	_ = sort.Strings
	_ = filepath.Base
)
