package db

import (
	"path/filepath"
	"testing"
)

// Smoke test: the v7 migration must apply through InitDB on a real file DB
// (WAL + foreign keys), creating the FTS tables/triggers and backfilling
// existing rows so search works end-to-end.
func TestInitDB_FTSMigrationSmoke(t *testing.T) {
	dir := t.TempDir()
	dbPath := filepath.Join(dir, "test.db")

	db1, err := InitDB(dbPath)
	if err != nil {
		t.Fatalf("InitDB (fresh): %v", err)
	}
	// Insert a project + note, then confirm the FTS index (created by the v7
	// migration) serves search end-to-end.
	res, err := db1.Exec("INSERT INTO projects (name, root_path) VALUES (?, ?)", "smoke", "/tmp/smoke")
	if err != nil {
		t.Fatalf("insert project: %v", err)
	}
	projectID, _ := res.LastInsertId()
	if _, err := CreateNoteEx(db1, projectID, "登录模块", "修复登录模块的若干Bug", "", "other", "manual"); err != nil {
		t.Fatalf("CreateNoteEx: %v", err)
	}
	// Search should work via the FTS index created by the migration.
	hits, err := SearchNotes(db1, "登录模块")
	if err != nil {
		t.Fatalf("SearchNotes after fresh init: %v", err)
	}
	if len(hits) != 1 {
		t.Fatalf("expected 1 hit, got %d", len(hits))
	}
	db1.Close()

	// Re-open the same DB: upgradeSchema must re-run idempotently (v7 already
	// applied) without error, and the index must remain consistent.
	db2, err := InitDB(dbPath)
	if err != nil {
		t.Fatalf("InitDB (reopen): %v", err)
	}
	defer db2.Close()
	hits, err = SearchNotes(db2, "登录模块")
	if err != nil {
		t.Fatalf("SearchNotes after reopen: %v", err)
	}
	if len(hits) != 1 {
		t.Errorf("expected 1 hit after reopen, got %d", len(hits))
	}

	// Backfill must be idempotent: force-set schema_version below v7 and
	// re-run upgrade so the backfill re-executes; no duplicate FTS rows.
	if _, err := db2.Exec("INSERT OR REPLACE INTO app_config (key, value) VALUES (?, '6')", migrationVersionKey); err != nil {
		t.Fatalf("reset schema version: %v", err)
	}
	if err := upgradeSchema(db2); err != nil {
		t.Fatalf("upgradeSchema re-run: %v", err)
	}
	hits, err = SearchNotes(db2, "登录模块")
	if err != nil {
		t.Fatalf("SearchNotes after backfill re-run: %v", err)
	}
	if len(hits) != 1 {
		t.Errorf("backfill should be idempotent; expected 1 hit, got %d (duplicate FTS rows?)", len(hits))
	}
}
