package db

import (
	"database/sql"
	"testing"
)

// setupTestDB creates an in-memory SQLite database with all tables for testing.
func setupTestDB(t *testing.T) *sql.DB {
	t.Helper()
	database, err := InitDB(":memory:")
	if err != nil {
		t.Fatalf("failed to init in-memory db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })
	return database
}

// createTestProject inserts a project and returns its ID.
func createTestProject(t *testing.T, db *sql.DB, name string) int64 {
	t.Helper()
	res, err := db.Exec(
		"INSERT INTO projects (name, root_path) VALUES (?, ?)",
		name, "/tmp/"+name,
	)
	if err != nil {
		t.Fatalf("failed to create test project: %v", err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("failed to get project id: %v", err)
	}
	return id
}

// -- Todo tests --
