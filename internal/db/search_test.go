package db

import (
	"testing"
)

// -- FTS5 search tests (issue #18) --

func TestSearchNotes_FTS_MatchesContent(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	pid := createTestProject(t, db, "search-project")

	// Create via CreateNoteEx so title is set (FTS indexes title + content).
	if _, err := CreateNoteEx(db, pid, "登录模块修复", "修复登录模块的若干Bug，提升稳定性", "", "other", "manual"); err != nil {
		t.Fatalf("CreateNoteEx: %v", err)
	}
	if _, err := CreateNoteEx(db, pid, "无关内容", "完全不同的主题，关于性能优化", "", "other", "manual"); err != nil {
		t.Fatalf("CreateNoteEx: %v", err)
	}

	// 3-char CJK term is FTS-usable: should match only the first note.
	hits, err := SearchNotes(db, "登录模块")
	if err != nil {
		t.Fatalf("SearchNotes: %v", err)
	}
	if len(hits) != 1 {
		t.Fatalf("expected 1 hit for '登录模块', got %d: %+v", len(hits), hits)
	}
	if hits[0].Title != "登录模块修复" {
		t.Errorf("unexpected hit title: %s", hits[0].Title)
	}
}

func TestSearchNotes_FTS_MultiTermIsAND(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	pid := createTestProject(t, db, "and-project")

	// Doc A contains both terms; Doc B contains only one.
	if _, err := CreateNoteEx(db, pid, "A", "the quick brown fox login flow", "", "other", "manual"); err != nil {
		t.Fatal(err)
	}
	if _, err := CreateNoteEx(db, pid, "B", "just the login screen", "", "other", "manual"); err != nil {
		t.Fatal(err)
	}

	hits, err := SearchNotes(db, "login flow")
	if err != nil {
		t.Fatalf("SearchNotes: %v", err)
	}
	// FTS combines phrase terms with implicit AND: only the doc with both
	// 'login' and 'flow' matches.
	if len(hits) != 1 || hits[0].Title != "A" {
		t.Errorf("expected only doc A (both terms), got %d: %+v", len(hits), hits)
	}
}

func TestSearchNotes_FTS_RanksByRelevance(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	pid := createTestProject(t, db, "rank-project")

	// Doc A: term in both title and content (denser match). Doc B: term only in
	// a longer content body. bm25 should rank A above B.
	if _, err := CreateNoteEx(db, pid, "login guide", "login flow details here", "", "other", "manual"); err != nil {
		t.Fatal(err)
	}
	if _, err := CreateNoteEx(db, pid, "misc", "some notes about login among many other words", "", "other", "manual"); err != nil {
		t.Fatal(err)
	}

	hits, err := SearchNotes(db, "login")
	if err != nil {
		t.Fatalf("SearchNotes: %v", err)
	}
	if len(hits) != 2 {
		t.Fatalf("expected 2 hits for 'login', got %d", len(hits))
	}
	if hits[0].Title != "login guide" {
		t.Errorf("expected 'login guide' ranked first by bm25, got %s", hits[0].Title)
	}
}

func TestSearchNotes_FTS_SpecialCharsNoError(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	pid := createTestProject(t, db, "special-project")

	if _, err := CreateNoteEx(db, pid, "x", `has "quotes" (and) :stars *`, "", "other", "manual"); err != nil {
		t.Fatal(err)
	}
	// A query with FTS special characters must not error; it is escaped to a
	// literal phrase. 'quotes' is >=3 chars so the FTS path is taken.
	hits, err := SearchNotes(db, `"quotes"`)
	if err != nil {
		t.Fatalf("SearchNotes with special chars errored: %v", err)
	}
	if len(hits) != 1 {
		t.Errorf("expected 1 hit for '\"quotes\"', got %d", len(hits))
	}
}

func TestSearchNotes_LIKEFallbackForShortQuery(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	pid := createTestProject(t, db, "short-project")

	// '登录' is 2 chars: trigram cannot match, so search falls back to LIKE.
	if _, err := CreateNoteEx(db, pid, "登录模块修复", "修复登录模块的若干Bug", "", "other", "manual"); err != nil {
		t.Fatal(err)
	}
	hits, err := SearchNotes(db, "登录")
	if err != nil {
		t.Fatalf("SearchNotes: %v", err)
	}
	if len(hits) != 1 {
		t.Errorf("expected 1 hit for 2-char '登录' via LIKE fallback, got %d", len(hits))
	}
}

func TestSearchNotes_FTS_IndexStaysInSync(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	pid := createTestProject(t, db, "sync-project")

	n, err := CreateNoteEx(db, pid, "draft", "initial content about networking", "", "other", "manual")
	if err != nil {
		t.Fatal(err)
	}
	if got, err := SearchNotes(db, "networking"); err != nil || len(got) != 1 {
		t.Fatalf("before update: expected 1 hit, got %d err=%v", len(got), err)
	}

	// Update content: old term should disappear, new term should appear.
	if err := UpdateNote(db, n.ID, "rewritten content about database"); err != nil {
		t.Fatal(err)
	}
	if got, err := SearchNotes(db, "networking"); err != nil {
		t.Fatalf("after update: %v", err)
	} else if len(got) != 0 {
		t.Errorf("old term 'networking' should no longer match after update, got %d", len(got))
	}
	if got, err := SearchNotes(db, "database"); err != nil {
		t.Fatalf("after update (new term): %v", err)
	} else if len(got) != 1 {
		t.Errorf("new term 'database' should match after update, got %d", len(got))
	}

	// Delete: no hits remain.
	if err := DeleteNote(db, n.ID); err != nil {
		t.Fatal(err)
	}
	if got, err := SearchNotes(db, "database"); err != nil {
		t.Fatalf("after delete: %v", err)
	} else if len(got) != 0 {
		t.Errorf("term should not match after delete, got %d", len(got))
	}
}

func TestSearchAll_NotesAndTodos(t *testing.T) {
	db := setupTestDB(t)
	defer db.Close()
	pid := createTestProject(t, db, "mixed-project")

	if _, err := CreateNoteEx(db, pid, "login note", "describes the login architecture", "", "other", "manual"); err != nil {
		t.Fatal(err)
	}
	if _, err := CreateTodo(db, pid, "Implement login screen"); err != nil {
		t.Fatal(err)
	}
	if _, err := CreateTodo(db, pid, "Unrelated task"); err != nil {
		t.Fatal(err)
	}

	hits, err := SearchAll(db, "login")
	if err != nil {
		t.Fatalf("SearchAll: %v", err)
	}
	// One note + one todo should match.
	var noteCount, todoCount int
	for _, h := range hits {
		switch h.Type {
		case "note":
			noteCount++
		case "todo":
			todoCount++
		}
	}
	if noteCount != 1 || todoCount != 1 {
		t.Errorf("expected 1 note + 1 todo, got %d notes + %d todos (all=%+v)", noteCount, todoCount, hits)
	}
}

func TestFTSUsable(t *testing.T) {
	cases := map[string]bool{
		"login":      true,  // 5 chars
		"登录模块":      true,  // 4 runes
		"login flow": true,  // both terms >=3
		"登录":         false, // 2 runes
		"ab":          false, // 2 chars
		"login ab":    false, // one term <3
		"":            false, // empty
		"   ":         false, // whitespace only
	}
	for q, want := range cases {
		if got := ftsUsable(q); got != want {
			t.Errorf("ftsUsable(%q) = %v, want %v", q, got, want)
		}
	}
}
