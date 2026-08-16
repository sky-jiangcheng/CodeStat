package db

import "database/sql"

// GetRepoMeta returns cached mined metadata for a repository.
func GetRepoMeta(db *sql.DB, repoID int64) (*RepoMeta, error) {
	m := &RepoMeta{}
	err := db.QueryRow(
		"SELECT repository_id, tech_stack, readme_excerpt, languages, dependencies, top_contributors, activity, updated_at FROM repo_meta WHERE repository_id = ?", repoID).
		Scan(&m.RepositoryID, &m.TechStack, &m.ReadmeExcerpt, &m.Languages, &m.Dependencies, &m.TopContributors, &m.Activity, &m.UpdatedAt)
	if err != nil {
		return nil, err
	}
	return m, nil
}

// UpsertRepoMeta inserts or updates cached mined metadata for a repository.
func UpsertRepoMeta(db *sql.DB, repoID int64, techStack, readme, languages, dependencies, topContributors, activity string) error {
	_, err := db.Exec(
		"INSERT INTO repo_meta (repository_id, tech_stack, readme_excerpt, languages, dependencies, top_contributors, activity, updated_at) VALUES (?, ?, ?, ?, ?, ?, ?, CURRENT_TIMESTAMP) "+
			"ON CONFLICT(repository_id) DO UPDATE SET tech_stack = excluded.tech_stack, readme_excerpt = excluded.readme_excerpt, languages = excluded.languages, dependencies = excluded.dependencies, top_contributors = excluded.top_contributors, activity = excluded.activity, updated_at = CURRENT_TIMESTAMP",
		repoID, techStack, readme, languages, dependencies, topContributors, activity)
	return err
}
