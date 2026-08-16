package db

import (
	"database/sql"
	"strings"
)

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
