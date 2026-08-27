package stats

import "time"

// Result holds commit statistics for a single query.
type Result struct {
	FilesChanged int
	LinesAdded   int
	LinesDeleted int
	Commits      int
}

// RepoMetaInfo holds inferred metadata about a repository for upsert.
type RepoMetaInfo struct {
	DisplayName  string
	User         string
	Organization string
}

// DailyEntry holds per-day stats for heatmap/history use.
type DailyEntry struct {
	Date         string `json:"date"`
	FilesChanged int    `json:"files_changed"`
	LinesAdded   int    `json:"lines_added"`
	LinesDeleted int    `json:"lines_deleted"`
	Commits      int    `json:"commits"`
}

// QueryTimeout is the maximum time allowed for a single git log query.
const QueryTimeout = 30 * time.Second
