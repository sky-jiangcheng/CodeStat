package db

import (
	"context"
	"database/sql"
	"strings"

	_ "modernc.org/sqlite"
)

const (
	searchProjectsLimit = 50
	searchResultLimit   = 20
	searchSnippetWindow = 100
)

// Project represents a row in the projects table.
type Project struct {
	ID            int64  `db:"id" json:"id"`
	Name          string `db:"name" json:"name"`
	RootPath      string `db:"root_path" json:"root_path"`
	LevelOverride int    `db:"level_override" json:"level_override"`
	IsAutoGrouped bool   `db:"is_auto_grouped" json:"is_auto_grouped"`
	IsStarred     bool   `db:"is_starred" json:"is_starred"`
	Collected     bool   `db:"collected" json:"collected"`
	CollectedAt   string `db:"collected_at" json:"collected_at"`
	CreatedAt     string `db:"created_at" json:"created_at"`
}

// Repository represents a row in the repositories table.
type Repository struct {
	ID            int64  `json:"id"`
	Path          string `json:"path"`
	ProjectID     *int64 `json:"project_id"`
	LastScannedAt *string `json:"last_scanned_at"`
}

// Todo represents a row in the project_todos table.
type Todo struct {
	ID        int64  `json:"id"`
	ProjectID int64  `json:"project_id"`
	Title     string `json:"title"`
	Completed bool   `json:"completed"`
	Priority  int    `json:"priority"`
	SortOrder int    `json:"sort_order"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// Note represents a row in the project_notes table.
type Note struct {
	ID        int64  `json:"id"`
	ProjectID int64  `json:"project_id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	Tags      string `json:"tags"`
	Kind      string `json:"kind"`
	Pinned    bool   `json:"pinned"`
	Source    string `json:"source"`
	SortOrder int    `json:"sort_order"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// NoteWithProject is a note joined with its parent project.
type NoteWithProject struct {
	Note
	ProjectName string `json:"project_name"`
}

// TodoCount holds incomplete and total todo counts for a project.
type TodoCount struct {
	ProjectID int64 `json:"project_id"`
	Count     int   `json:"count"`
	Total     int   `json:"total"`
}

// NoteCount holds the note count for a project.
type NoteCount struct {
	ProjectID int64 `json:"project_id"`
	Count     int   `json:"count"`
}

// DailyStat represents a row in the daily_stats table.
type DailyStat struct {
	ID           int64  `json:"id"`
	RepositoryID int64  `json:"repository_id"`
	StatDate     string `json:"stat_date"`
	Author       string `json:"author"`
	FilesChanged int    `json:"files_changed"`
	LinesAdded   int    `json:"lines_added"`
	LinesDeleted int    `json:"lines_deleted"`
}

// HeatmapDay holds aggregated stats for a single day.
type HeatmapDay struct {
	Date         string `json:"date"`
	LinesAdded   int    `json:"lines_added"`
	LinesDeleted int    `json:"lines_deleted"`
	Commits      int    `json:"commits"`
}

// SearchHit is a unified search result from notes and todos.
type SearchHit struct {
	Type      string `json:"type"`
	ID        int64  `json:"id"`
	ProjectID int64  `json:"project_id"`
	Title     string `json:"title"`
	Snippet   string `json:"snippet"`
}

// RepoMeta represents a row in the repo_meta table.
type RepoMeta struct {
	RepositoryID  int64  `json:"repository_id"`
	TechStack     string `json:"tech_stack"`
	ReadmeExcerpt string `json:"readme_excerpt"`
	Languages     string `json:"languages"`
	UpdatedAt     string `json:"updated_at"`
}

const projectColumns = "id, name, root_path, level_override, is_auto_grouped, is_starred, created_at"

// -- Projects --

// GetAllProjects returns all projects, starred first then by name.
func GetAllProjects(db *sql.DB) ([]Project, error) {
	rows, err := db.Query("SELECT " + projectColumns + " FROM projects ORDER BY is_starred DESC, name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.RootPath, &p.LevelOverride, &p.IsAutoGrouped, &p.IsStarred, &p.CreatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

// GetStarredProjects returns only starred projects, ordered by name.
func GetStarredProjects(db *sql.DB) ([]Project, error) {
	rows, err := db.Query("SELECT " + projectColumns + " FROM projects WHERE is_starred = 1 ORDER BY name ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.RootPath, &p.LevelOverride, &p.IsAutoGrouped, &p.IsStarred, &p.CreatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

// GetProjectByID returns a single project by id.
func GetProjectByID(db *sql.DB, id int64) (*Project, error) {
	p := &Project{}
	err := db.QueryRow("SELECT "+projectColumns+" FROM projects WHERE id = ?", id).
		Scan(&p.ID, &p.Name, &p.RootPath, &p.LevelOverride, &p.IsAutoGrouped, &p.IsStarred, &p.CreatedAt)
	if err != nil {
		return nil, err
	}
	return p, nil
}

// SearchProjects searches projects by name or root_path. An empty or
// whitespace-only query returns nil. LIKE wildcards in the query are escaped.
func SearchProjects(db *sql.DB, query string) ([]Project, error) {
	if strings.TrimSpace(query) == "" {
		return nil, nil
	}
	pattern := "%" + escapeLike(query) + "%"
	rows, err := db.Query(
		"SELECT "+projectColumns+" FROM projects WHERE name LIKE ? ESCAPE '\\' OR root_path LIKE ? ESCAPE '\\' ORDER BY name ASC LIMIT ?",
		pattern, pattern, searchProjectsLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var projects []Project
	for rows.Next() {
		var p Project
		if err := rows.Scan(&p.ID, &p.Name, &p.RootPath, &p.LevelOverride, &p.IsAutoGrouped, &p.IsStarred, &p.CreatedAt); err != nil {
			return nil, err
		}
		projects = append(projects, p)
	}
	return projects, rows.Err()
}

// ToggleProjectStar flips the starred flag of a project and returns the new value.
func ToggleProjectStar(db *sql.DB, projectID int64) (bool, error) {
	var starred bool
	err := db.QueryRow("SELECT is_starred FROM projects WHERE id = ?", projectID).Scan(&starred)
	if err != nil {
		return false, err
	}
	newStarred := !starred
	if _, err := db.Exec("UPDATE projects SET is_starred = ? WHERE id = ?", newStarred, projectID); err != nil {
		return false, err
	}
	return newStarred, nil
}

// SyncProjectTx inserts a project for rootPath if absent, or updates an existing
// one. The starred flag is always preserved. is_auto_grouped is only refreshed
// when the existing project is still auto-grouped (manually adjusted projects
// stay manual). Returns the project id.
func SyncProjectTx(tx *sql.Tx, name, rootPath string, level int, isAuto bool) (int64, error) {
	var id int64
	var existingAuto bool
	err := tx.QueryRow("SELECT id, is_auto_grouped FROM projects WHERE root_path = ?", rootPath).Scan(&id, &existingAuto)
	if err == sql.ErrNoRows {
		res, err := tx.Exec(
			"INSERT INTO projects (name, root_path, level_override, is_auto_grouped) VALUES (?, ?, ?, ?)",
			name, rootPath, level, isAuto)
		if err != nil {
			return 0, err
		}
		newID, err := res.LastInsertId()
		if err != nil {
			return 0, err
		}
		return newID, nil
	}
	if err != nil {
		return 0, err
	}
	newAuto := existingAuto && isAuto
	if _, err := tx.Exec(
		"UPDATE projects SET name = ?, level_override = ?, is_auto_grouped = ? WHERE id = ?",
		name, level, newAuto, id); err != nil {
		return 0, err
	}
	return id, nil
}

// GetCollectedProjectIDs returns the ids of all projects marked as collected.
func GetCollectedProjectIDs(ctx context.Context, db *sql.DB) ([]int64, error) {
	rows, err := db.QueryContext(ctx, "SELECT id FROM projects WHERE collected = TRUE")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var ids []int64
	for rows.Next() {
		var id int64
		if err := rows.Scan(&id); err != nil {
			return nil, err
		}
		ids = append(ids, id)
	}
	return ids, rows.Err()
}

// -- Todos --

// CreateTodo inserts a new todo for a project, assigning the next sort_order.
func CreateTodo(db *sql.DB, projectID int64, title string) (*Todo, error) {
	var sortOrder int
	if err := db.QueryRow(
		"SELECT COALESCE(MAX(sort_order), -1) + 1 FROM project_todos WHERE project_id = ?", projectID).
		Scan(&sortOrder); err != nil {
		return nil, err
	}
	res, err := db.Exec(
		"INSERT INTO project_todos (project_id, title, sort_order) VALUES (?, ?, ?)",
		projectID, title, sortOrder)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return getTodoByID(db, id)
}

// ListTodos returns all todos for a project ordered by sort_order.
func ListTodos(db *sql.DB, projectID int64) ([]Todo, error) {
	rows, err := db.Query(
		"SELECT id, project_id, title, completed, priority, sort_order, created_at, updated_at FROM project_todos WHERE project_id = ? ORDER BY sort_order ASC, id ASC",
		projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var todos []Todo
	for rows.Next() {
		var t Todo
		if err := rows.Scan(&t.ID, &t.ProjectID, &t.Title, &t.Completed, &t.Priority, &t.SortOrder, &t.CreatedAt, &t.UpdatedAt); err != nil {
			return nil, err
		}
		todos = append(todos, t)
	}
	return todos, rows.Err()
}

// ToggleTodo flips the completed status of a todo. An absent id yields an error.
func ToggleTodo(db *sql.DB, todoID int64) error {
	res, err := db.Exec("UPDATE project_todos SET completed = NOT completed, updated_at = CURRENT_TIMESTAMP WHERE id = ?", todoID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteTodo removes a todo. Deleting an absent id is not an error.
func DeleteTodo(db *sql.DB, todoID int64) error {
	_, err := db.Exec("DELETE FROM project_todos WHERE id = ?", todoID)
	return err
}

// ReorderTodos assigns sort_order by the position of each id in the slice.
func ReorderTodos(db *sql.DB, todoIDs []int64) error {
	for i, id := range todoIDs {
		if _, err := db.Exec("UPDATE project_todos SET sort_order = ? WHERE id = ?", i, id); err != nil {
			return err
		}
	}
	return nil
}

// GetTodoCounts returns per-project incomplete (Count) and total (Total) todos.
func GetTodoCounts(db *sql.DB) ([]TodoCount, error) {
	rows, err := db.Query(
		"SELECT project_id, SUM(CASE WHEN completed = 0 THEN 1 ELSE 0 END), COUNT(*) FROM project_todos GROUP BY project_id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var counts []TodoCount
	for rows.Next() {
		var pid int64
		var count, total int64
		if err := rows.Scan(&pid, &count, &total); err != nil {
			return nil, err
		}
		counts = append(counts, TodoCount{ProjectID: pid, Count: int(count), Total: int(total)})
	}
	return counts, rows.Err()
}

func getTodoByID(db *sql.DB, id int64) (*Todo, error) {
	t := &Todo{}
	err := db.QueryRow(
		"SELECT id, project_id, title, completed, priority, sort_order, created_at, updated_at FROM project_todos WHERE id = ?", id).
		Scan(&t.ID, &t.ProjectID, &t.Title, &t.Completed, &t.Priority, &t.SortOrder, &t.CreatedAt, &t.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return t, nil
}

// -- Notes --

// CreateNote inserts a new note for a project.
func CreateNote(db *sql.DB, projectID int64, content string) (*Note, error) {
	return CreateNoteEx(db, projectID, "", content, "", "other", "manual")
}

// CreateNoteEx inserts a new note with explicit metadata.
func CreateNoteEx(db *sql.DB, projectID int64, title, content, tags, kind, source string) (*Note, error) {
	res, err := db.Exec(
		"INSERT INTO project_notes (project_id, title, content, tags, kind, source) VALUES (?, ?, ?, ?, ?, ?)",
		projectID, title, content, tags, kind, source)
	if err != nil {
		return nil, err
	}
	id, err := res.LastInsertId()
	if err != nil {
		return nil, err
	}
	return getNoteByID(db, id)
}

// ListNotes returns all notes for a project, pinned first then by recency.
func ListNotes(db *sql.DB, projectID int64) ([]Note, error) {
	rows, err := db.Query(
		"SELECT id, project_id, title, content, tags, kind, pinned, source, sort_order, created_at, updated_at FROM project_notes WHERE project_id = ? ORDER BY pinned DESC, sort_order ASC, created_at ASC, id ASC",
		projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var notes []Note
	for rows.Next() {
		var n Note
		if err := rows.Scan(&n.ID, &n.ProjectID, &n.Title, &n.Content, &n.Tags, &n.Kind, &n.Pinned, &n.Source, &n.SortOrder, &n.CreatedAt, &n.UpdatedAt); err != nil {
			return nil, err
		}
		notes = append(notes, n)
	}
	return notes, rows.Err()
}

// UpdateNote updates the content of a note. An absent id yields an error.
func UpdateNote(db *sql.DB, noteID int64, content string) error {
	res, err := db.Exec(
		"UPDATE project_notes SET content = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f','now') WHERE id = ?",
		content, noteID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// DeleteNote removes a note. Deleting an absent id is not an error.
func DeleteNote(db *sql.DB, noteID int64) error {
	_, err := db.Exec("DELETE FROM project_notes WHERE id = ?", noteID)
	return err
}

// UpdateNoteMeta updates a note's editable metadata.
func UpdateNoteMeta(db *sql.DB, noteID int64, title, tags, kind string, pinned bool) error {
	res, err := db.Exec(
		"UPDATE project_notes SET title = ?, tags = ?, kind = ?, pinned = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f','now') WHERE id = ?",
		title, tags, kind, pinned, noteID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// MoveNote reassigns a note to a different project.
func MoveNote(db *sql.DB, noteID, projectID int64) error {
	res, err := db.Exec(
		"UPDATE project_notes SET project_id = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f','now') WHERE id = ?",
		projectID, noteID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// PinNote sets or clears the pinned flag on a note.
func PinNote(db *sql.DB, noteID int64, pinned bool) error {
	res, err := db.Exec(
		"UPDATE project_notes SET pinned = ?, updated_at = strftime('%Y-%m-%d %H:%M:%f','now') WHERE id = ?",
		pinned, noteID)
	if err != nil {
		return err
	}
	n, err := res.RowsAffected()
	if err != nil {
		return err
	}
	if n == 0 {
		return sql.ErrNoRows
	}
	return nil
}

// GetNoteBySourceTitle returns a note matching a project, source and title.
func GetNoteBySourceTitle(db *sql.DB, projectID int64, source, title string) (*Note, error) {
	n := &Note{}
	err := db.QueryRow(
		"SELECT id, project_id, title, content, tags, kind, pinned, source, sort_order, created_at, updated_at FROM project_notes WHERE project_id = ? AND source = ? AND title = ?",
		projectID, source, title).
		Scan(&n.ID, &n.ProjectID, &n.Title, &n.Content, &n.Tags, &n.Kind, &n.Pinned, &n.Source, &n.SortOrder, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return n, nil
}

// ListAllNotes returns every note across all projects joined with project name.
func ListAllNotes(db *sql.DB) ([]NoteWithProject, error) {
	rows, err := db.Query(
		"SELECT n.id, n.project_id, n.title, n.content, n.tags, n.kind, n.pinned, n.source, n.sort_order, n.created_at, n.updated_at, p.name FROM project_notes n JOIN projects p ON p.id = n.project_id ORDER BY n.pinned DESC, n.updated_at DESC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var notes []NoteWithProject
	for rows.Next() {
		var np NoteWithProject
		if err := rows.Scan(&np.ID, &np.ProjectID, &np.Title, &np.Content, &np.Tags, &np.Kind, &np.Pinned, &np.Source, &np.SortOrder, &np.CreatedAt, &np.UpdatedAt, &np.ProjectName); err != nil {
			return nil, err
		}
		notes = append(notes, np)
	}
	return notes, rows.Err()
}

// ListAllTags returns the distinct set of non-empty tag strings.
func ListAllTags(db *sql.DB) ([]string, error) {
	rows, err := db.Query("SELECT DISTINCT tags FROM project_notes WHERE tags != '' ORDER BY tags ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var tags []string
	for rows.Next() {
		var t string
		if err := rows.Scan(&t); err != nil {
			return nil, err
		}
		tags = append(tags, t)
	}
	return tags, rows.Err()
}

// GetNoteCounts returns the number of notes per project.
func GetNoteCounts(db *sql.DB) ([]NoteCount, error) {
	rows, err := db.Query("SELECT project_id, COUNT(*) FROM project_notes GROUP BY project_id")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var counts []NoteCount
	for rows.Next() {
		var pid int64
		var c int64
		if err := rows.Scan(&pid, &c); err != nil {
			return nil, err
		}
		counts = append(counts, NoteCount{ProjectID: pid, Count: int(c)})
	}
	return counts, rows.Err()
}

func getNoteByID(db *sql.DB, id int64) (*Note, error) {
	n := &Note{}
	err := db.QueryRow(
		"SELECT id, project_id, title, content, tags, kind, pinned, source, sort_order, created_at, updated_at FROM project_notes WHERE id = ?", id).
		Scan(&n.ID, &n.ProjectID, &n.Title, &n.Content, &n.Tags, &n.Kind, &n.Pinned, &n.Source, &n.SortOrder, &n.CreatedAt, &n.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return n, nil
}

// -- Repositories --

// GetAllRepositories returns all repositories ordered by path.
func GetAllRepositories(db *sql.DB) ([]Repository, error) {
	rows, err := db.Query("SELECT id, path, project_id, last_scanned_at FROM repositories ORDER BY path ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var repos []Repository
	for rows.Next() {
		var r Repository
		if err := rows.Scan(&r.ID, &r.Path, &r.ProjectID, &r.LastScannedAt); err != nil {
			return nil, err
		}
		repos = append(repos, r)
	}
	return repos, rows.Err()
}

// GetRepositoriesByProjectID returns all repositories for a project.
func GetRepositoriesByProjectID(db *sql.DB, projectID int64) ([]Repository, error) {
	rows, err := db.Query("SELECT id, path, project_id, last_scanned_at FROM repositories WHERE project_id = ? ORDER BY path ASC", projectID)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var repos []Repository
	for rows.Next() {
		var r Repository
		if err := rows.Scan(&r.ID, &r.Path, &r.ProjectID, &r.LastScannedAt); err != nil {
			return nil, err
		}
		repos = append(repos, r)
	}
	return repos, rows.Err()
}

// UpsertRepositoryTx inserts or updates a repository row by path.
func UpsertRepositoryTx(tx *sql.Tx, path string, projectID int64) error {
	_, err := tx.Exec(
		"INSERT INTO repositories (path, project_id) VALUES (?, ?) ON CONFLICT(path) DO UPDATE SET project_id = excluded.project_id",
		path, projectID)
	return err
}

// UpdateRepositoryLastScanned stamps a repository's last_scanned_at to now.
func UpdateRepositoryLastScanned(db *sql.DB, repoID int64) error {
	_, err := db.Exec("UPDATE repositories SET last_scanned_at = CURRENT_TIMESTAMP WHERE id = ?", repoID)
	return err
}

// -- Stats --

// UpsertDailyStat inserts or updates a daily stat row by (repo, date, author).
func UpsertDailyStat(db *sql.DB, repoID int64, date, author string, files, added, deleted int) error {
	_, err := db.Exec(
		"INSERT INTO daily_stats (repository_id, stat_date, author, files_changed, lines_added, lines_deleted) VALUES (?, ?, ?, ?, ?, ?) "+
			"ON CONFLICT(repository_id, stat_date, author) DO UPDATE SET files_changed = excluded.files_changed, lines_added = excluded.lines_added, lines_deleted = excluded.lines_deleted",
		repoID, date, author, files, added, deleted)
	return err
}

// GetStatsByProject returns daily stats for a project, optionally for one date.
func GetStatsByProject(db *sql.DB, projectID int64, date string) ([]DailyStat, error) {
	q := "SELECT d.id, d.repository_id, d.stat_date, d.author, d.files_changed, d.lines_added, d.lines_deleted " +
		"FROM daily_stats d JOIN repositories r ON r.id = d.repository_id WHERE r.project_id = ?"
	if date != "" {
		q += " AND d.stat_date = ?"
		q += " ORDER BY d.stat_date DESC, d.author ASC"
		rows, err := db.Query(q, projectID, date)
		return scanDailyStats(rows, err)
	}
	q += " ORDER BY d.stat_date DESC, d.author ASC"
	rows, err := db.Query(q, projectID)
	return scanDailyStats(rows, err)
}

// GetStatsByRepositoryAndDate returns daily stats for a repo, optionally one date.
func GetStatsByRepositoryAndDate(db *sql.DB, repoID int64, date string) ([]DailyStat, error) {
	q := "SELECT id, repository_id, stat_date, author, files_changed, lines_added, lines_deleted FROM daily_stats WHERE repository_id = ?"
	if date != "" {
		q += " AND stat_date = ?"
		q += " ORDER BY stat_date DESC, author ASC"
		rows, err := db.Query(q, repoID, date)
		return scanDailyStats(rows, err)
	}
	q += " ORDER BY stat_date DESC, author ASC"
	rows, err := db.Query(q, repoID)
	return scanDailyStats(rows, err)
}

// GetStatsByDate returns all daily stats for a given date.
func GetStatsByDate(db *sql.DB, date string) ([]DailyStat, error) {
	rows, err := db.Query("SELECT id, repository_id, stat_date, author, files_changed, lines_added, lines_deleted FROM daily_stats WHERE stat_date = ?", date)
	return scanDailyStats(rows, err)
}

// GetHeatmapData returns per-day aggregated stats between start and end.
func GetHeatmapData(db *sql.DB, start, end, gitUser string) ([]HeatmapDay, error) {
	var rows *sql.Rows
	var err error
	if gitUser != "" {
		rows, err = db.Query(
			"SELECT stat_date, COALESCE(SUM(lines_added),0), COALESCE(SUM(lines_deleted),0), COUNT(DISTINCT author) FROM daily_stats WHERE stat_date BETWEEN ? AND ? AND author = ? GROUP BY stat_date ORDER BY stat_date ASC",
			start, end, gitUser)
	} else {
		rows, err = db.Query(
			"SELECT stat_date, COALESCE(SUM(lines_added),0), COALESCE(SUM(lines_deleted),0), COUNT(DISTINCT author) FROM daily_stats WHERE stat_date BETWEEN ? AND ? GROUP BY stat_date ORDER BY stat_date ASC",
			start, end)
	}
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var days []HeatmapDay
	for rows.Next() {
		var d HeatmapDay
		if err := rows.Scan(&d.Date, &d.LinesAdded, &d.LinesDeleted, &d.Commits); err != nil {
			return nil, err
		}
		days = append(days, d)
	}
	return days, rows.Err()
}

func scanDailyStats(rows *sql.Rows, err error) ([]DailyStat, error) {
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var stats []DailyStat
	for rows.Next() {
		var s DailyStat
		if err := rows.Scan(&s.ID, &s.RepositoryID, &s.StatDate, &s.Author, &s.FilesChanged, &s.LinesAdded, &s.LinesDeleted); err != nil {
			return nil, err
		}
		stats = append(stats, s)
	}
	return stats, rows.Err()
}

// -- Repo meta --

// GetRepoMeta returns cached mined metadata for a repository.
func GetRepoMeta(db *sql.DB, repoID int64) (*RepoMeta, error) {
	m := &RepoMeta{}
	err := db.QueryRow(
		"SELECT repository_id, tech_stack, readme_excerpt, languages, updated_at FROM repo_meta WHERE repository_id = ?", repoID).
		Scan(&m.RepositoryID, &m.TechStack, &m.ReadmeExcerpt, &m.Languages, &m.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return m, nil
}

// UpsertRepoMeta inserts or updates cached mined metadata for a repository.
func UpsertRepoMeta(db *sql.DB, repoID int64, techStack, readme, languages string) error {
	_, err := db.Exec(
		"INSERT INTO repo_meta (repository_id, tech_stack, readme_excerpt, languages, updated_at) VALUES (?, ?, ?, ?, CURRENT_TIMESTAMP) "+
			"ON CONFLICT(repository_id) DO UPDATE SET tech_stack = excluded.tech_stack, readme_excerpt = excluded.readme_excerpt, languages = excluded.languages, updated_at = CURRENT_TIMESTAMP",
		repoID, techStack, readme, languages)
	return err
}

// -- Config & scan roots --

// GetConfig returns the value for a config key, or "" when absent.
func GetConfig(db *sql.DB, key string) (string, error) {
	var v string
	err := db.QueryRow("SELECT value FROM app_config WHERE key = ?", key).Scan(&v)
	if err == sql.ErrNoRows {
		return "", nil
	}
	if err != nil {
		return "", err
	}
	return v, nil
}

// SetConfig sets a config key-value pair.
func SetConfig(db *sql.DB, key, value string) error {
	_, err := db.Exec("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, ?)", key, value)
	return err
}

// GetAllConfigs returns all config key-value pairs.
func GetAllConfigs(db *sql.DB) (map[string]string, error) {
	rows, err := db.Query("SELECT key, value FROM app_config")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	configs := map[string]string{}
	for rows.Next() {
		var k, v string
		if err := rows.Scan(&k, &v); err != nil {
			return nil, err
		}
		configs[k] = v
	}
	return configs, rows.Err()
}

// GetScanRoots returns all configured scan root paths.
func GetScanRoots(db *sql.DB) ([]string, error) {
	rows, err := db.Query("SELECT path FROM scan_roots ORDER BY path ASC")
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var roots []string
	for rows.Next() {
		var p string
		if err := rows.Scan(&p); err != nil {
			return nil, err
		}
		roots = append(roots, p)
	}
	return roots, rows.Err()
}

// ReplaceScanRoots atomically replaces the scan root list.
func ReplaceScanRoots(db *sql.DB, roots []string) error {
	tx, err := db.Begin()
	if err != nil {
		return err
	}
	defer tx.Rollback() //nolint:errcheck
	if _, err := tx.Exec("DELETE FROM scan_roots"); err != nil {
		return err
	}
	for _, r := range roots {
		if _, err := tx.Exec("INSERT OR IGNORE INTO scan_roots (path) VALUES (?)", r); err != nil {
			return err
		}
	}
	return tx.Commit()
}

// -- Cleanup --

// CleanupStaleDataTx removes repositories (and their stats) whose paths are not
// in scannedPaths, then deletes orphaned projects that have no repositories,
// notes, or todos. An empty scannedPaths slice treats all repos as stale.
func CleanupStaleDataTx(tx *sql.Tx, scannedPaths []string) error {
	if len(scannedPaths) > 0 {
		placeholders := strings.Repeat("?,", len(scannedPaths))
		placeholders = placeholders[:len(placeholders)-1]
		args := make([]any, len(scannedPaths))
		for i, p := range scannedPaths {
			args[i] = p
		}
		if _, err := tx.Exec(
			"DELETE FROM daily_stats WHERE repository_id IN (SELECT id FROM repositories WHERE path NOT IN ("+placeholders+"))",
			args...); err != nil {
			return err
		}
		if _, err := tx.Exec(
			"DELETE FROM repositories WHERE path NOT IN ("+placeholders+")",
			args...); err != nil {
			return err
		}
	} else {
		if _, err := tx.Exec("DELETE FROM daily_stats"); err != nil {
			return err
		}
		if _, err := tx.Exec("DELETE FROM repositories"); err != nil {
			return err
		}
	}
	_, err := tx.Exec(
		"DELETE FROM projects WHERE NOT EXISTS (SELECT 1 FROM repositories WHERE repositories.project_id = projects.id) " +
			"AND NOT EXISTS (SELECT 1 FROM project_notes WHERE project_notes.project_id = projects.id) " +
			"AND NOT EXISTS (SELECT 1 FROM project_todos WHERE project_todos.project_id = projects.id)")
	return err
}

// -- Search --

// SearchNotes searches note title and content, returning ranked hits.
func SearchNotes(db *sql.DB, query string) ([]SearchHit, error) {
	q := strings.TrimSpace(query)
	if q == "" {
		return nil, nil
	}
	pattern := "%" + escapeLike(q) + "%"
	rows, err := db.Query(
		"SELECT id, project_id, title, content FROM project_notes WHERE title LIKE ? ESCAPE '\\' OR content LIKE ? ESCAPE '\\' ORDER BY pinned DESC, updated_at DESC LIMIT ?",
		pattern, pattern, searchResultLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var hits []SearchHit
	for rows.Next() {
		var h SearchHit
		var content string
		if err := rows.Scan(&h.ID, &h.ProjectID, &h.Title, &content); err != nil {
			return nil, err
		}
		h.Type = "note"
		h.Snippet = makeSnippet(content, q)
		hits = append(hits, h)
	}
	return hits, rows.Err()
}

// SearchAll searches notes and todos, returning unified ranked hits.
func SearchAll(db *sql.DB, query string) ([]SearchHit, error) {
	hits, err := SearchNotes(db, query)
	if err != nil {
		return nil, err
	}
	q := strings.TrimSpace(query)
	if q == "" {
		return hits, nil
	}
	pattern := "%" + escapeLike(q) + "%"
	rows, err := db.Query(
		"SELECT id, project_id, title FROM project_todos WHERE title LIKE ? ESCAPE '\\' ORDER BY sort_order ASC, id ASC LIMIT ?",
		pattern, searchResultLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	for rows.Next() {
		var h SearchHit
		if err := rows.Scan(&h.ID, &h.ProjectID, &h.Title); err != nil {
			return nil, err
		}
		h.Type = "todo"
		h.Snippet = h.Title
		hits = append(hits, h)
	}
	if err := rows.Err(); err != nil {
		return nil, err
	}
	return hits, nil
}

func escapeLike(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}

func makeSnippet(content, query string) string {
	if len(content) <= searchSnippetWindow {
		return content
	}
	idx := strings.Index(strings.ToLower(content), strings.ToLower(query))
	if idx < 0 {
		return content[:searchSnippetWindow]
	}
	start := idx - searchSnippetWindow/2
	if start < 0 {
		start = 0
	}
	end := start + searchSnippetWindow
	if end > len(content) {
		end = len(content)
	}
	return content[start:end]
}
