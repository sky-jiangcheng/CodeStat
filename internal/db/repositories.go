package db

import "database/sql"

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
		if err := rows.Scan(&r.ID, &r.Path, &r.ProjectID, &r.LastScanned); err != nil {
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
		if err := rows.Scan(&r.ID, &r.Path, &r.ProjectID, &r.LastScanned); err != nil {
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
