package db

import (
	"database/sql"
	"fmt"
	"log"
	"strconv"
	"strings"
)

	_ "modernc.org/sqlite"
)

const (
	migrationVersionKey = "schema_version"
	searchProjectsLimit = 50
	searchResultLimit   = 20
	searchSnippetWindow = 100
)

type Project struct {
	ID           int64          `db:"id"`
	Name         string         `db:"name"`
	RootPath     string         `db:"root_path"`
	LevelOverride int            `db:"level_override"`
	IsAutoGrouped bool           `db:"is_auto_grouped"`
	IsStarred    int            `db:"is_starred"`
	CreatedAt    string         `db:"created_at"`
	Collected    bool           `db:"collected"`
	CollectedAt  string         `db:"collected_at"`
}

// GetCollectedProjectIDs returns the IDs of all projects marked as collected.
func (q *Queries) GetCollectedProjectIDs(ctx context.Context, db *sql.DB) ([]int64, error) {
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
