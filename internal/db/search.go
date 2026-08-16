package db

import (
	"database/sql"
	"strings"
	"unicode/utf8"
)

const (
	searchResultLimit   = 20
	searchSnippetWindow = 100
)

// SearchNotes searches note title and content, returning ranked hits. It uses
// the FTS5 trigram index (issue #18) for relevance-ranked substring matching
// when every query term is at least 3 characters; otherwise it falls back to a
// LIKE scan (which also covers 2-character CJK queries the trigram tokenizer
// cannot match). If the FTS index is unavailable or yields no rows, it falls
// back to LIKE so search never regresses.
func SearchNotes(db *sql.DB, query string) ([]SearchHit, error) {
	q := strings.TrimSpace(query)
	if q == "" {
		return nil, nil
	}
	if ftsUsable(q) {
		hits, err := searchNotesFTS(db, q)
		if err == nil {
			return hits, nil
		}
		// FTS index missing or query rejected: fall through to LIKE.
	}
	return searchNotesLike(db, q)
}

// searchNotesFTS matches the query against the FTS5 index, ranked by bm25.
func searchNotesFTS(db *sql.DB, q string) ([]SearchHit, error) {
	rows, err := db.Query(
		"SELECT n.id, n.project_id, n.title, n.content, bm25(project_notes_fts) "+
			"FROM project_notes_fts f "+
			"JOIN project_notes n ON n.id = f.rowid "+
			"WHERE project_notes_fts MATCH ? "+
			"ORDER BY bm25(project_notes_fts), n.pinned DESC, n.updated_at DESC LIMIT ?",
		escapeFTS(q), searchResultLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var hits []SearchHit
	for rows.Next() {
		var h SearchHit
		var content string
		var rank float64
		if err := rows.Scan(&h.ID, &h.ProjectID, &h.Title, &content, &rank); err != nil {
			return nil, err
		}
		h.Type = "note"
		h.Rank = rank
		h.Snippet = makeSnippet(content, q)
		hits = append(hits, h)
	}
	return hits, rows.Err()
}

// searchNotesLike is the LIKE-based fallback used for short or special queries.
func searchNotesLike(db *sql.DB, q string) ([]SearchHit, error) {
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
		h.Rank = 0 // LIKE fallback has no bm25 score
		h.Snippet = makeSnippet(content, q)
		hits = append(hits, h)
	}
	return hits, rows.Err()
}

// SearchAll searches notes and todos, returning unified ranked hits. Notes use
// the FTS5 path (with LIKE fallback) via SearchNotes; todos use the FTS index
// when usable and fall back to LIKE otherwise.
func SearchAll(db *sql.DB, query string) ([]SearchHit, error) {
	hits, err := SearchNotes(db, query)
	if err != nil {
		return nil, err
	}
	q := strings.TrimSpace(query)
	if q == "" {
		return hits, nil
	}
	todoHits, err := searchTodos(db, q)
	if err != nil {
		return nil, err
	}
	return append(hits, todoHits...), nil
}

// searchTodos searches todo titles via FTS5 when usable, else LIKE.
func searchTodos(db *sql.DB, q string) ([]SearchHit, error) {
	if ftsUsable(q) {
		hits, err := searchTodosFTS(db, q)
		if err == nil {
			return hits, nil
		}
	}
	return searchTodosLike(db, q)
}

func searchTodosFTS(db *sql.DB, q string) ([]SearchHit, error) {
	rows, err := db.Query(
		"SELECT t.id, t.project_id, t.title FROM project_todos_fts f "+
			"JOIN project_todos t ON t.id = f.rowid "+
			"WHERE project_todos_fts MATCH ? "+
			"ORDER BY bm25(project_todos_fts), t.sort_order ASC, t.id ASC LIMIT ?",
		escapeFTS(q), searchResultLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var hits []SearchHit
	for rows.Next() {
		var h SearchHit
		if err := rows.Scan(&h.ID, &h.ProjectID, &h.Title); err != nil {
			return nil, err
		}
		h.Type = "todo"
		h.Snippet = h.Title
		hits = append(hits, h)
	}
	return hits, rows.Err()
}

func searchTodosLike(db *sql.DB, q string) ([]SearchHit, error) {
	pattern := "%" + escapeLike(q) + "%"
	rows, err := db.Query(
		"SELECT id, project_id, title FROM project_todos WHERE title LIKE ? ESCAPE '\\' ORDER BY sort_order ASC, id ASC LIMIT ?",
		pattern, searchResultLimit)
	if err != nil {
		return nil, err
	}
	defer rows.Close()
	var hits []SearchHit
	for rows.Next() {
		var h SearchHit
		if err := rows.Scan(&h.ID, &h.ProjectID, &h.Title); err != nil {
			return nil, err
		}
		h.Type = "todo"
		h.Snippet = h.Title
		hits = append(hits, h)
	}
	return hits, rows.Err()
}

// ftsUsable reports whether the query can be served by the trigram FTS index.
// The trigram tokenizer extracts 3-character sequences, so a term shorter than
// 3 characters cannot match; in that case the caller falls back to LIKE.
func ftsUsable(query string) bool {
	for _, term := range strings.Fields(query) {
		if utf8.RuneCountInString(term) < 3 {
			return false
		}
	}
	return len(strings.Fields(query)) > 0
}

// escapeFTS builds an FTS5 MATCH expression from the query: each
// whitespace-separated term is wrapped as a phrase (double quotes escaped) and
// terms are combined with implicit AND. Wrapping as a phrase neutralises FTS
// special characters (*, :, AND, parentheses, etc.) so user input is treated
// as literal substring terms, not query syntax.
func escapeFTS(query string) string {
	var parts []string
	for _, term := range strings.Fields(query) {
		term = strings.ReplaceAll(term, `"`, `""`)
		parts = append(parts, `"`+term+`"`)
	}
	return strings.Join(parts, " ")
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
	snippet := content[start:end]
	// Highlight matched query text with <mark> tags for visual emphasis.
	snippet = strings.ReplaceAll(snippet, query, "<mark>"+query+"</mark>")
	return snippet
}
