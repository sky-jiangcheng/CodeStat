package db

import "database/sql"

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

// GetNoteByID returns a single note by its ID.
func GetNoteByID(db *sql.DB, id int64) (*Note, error) {
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
