package db

import "database/sql"

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
