// Package knowledge provides functions to mine descriptive information from a
// git repository: README excerpt, tech stack detection, language breakdown,
// dependencies, top contributors and recent activity.
package knowledge

// Tech is a single detected technology entry.
type Tech struct {
	Name     string `json:"name"`
	Category string `json:"category"` // "language" | "framework" | "tool"
}

// LanguageStat is a language with its LOC, used for the breakdown list.
type LanguageStat struct {
	Language string `json:"language"`
	Count    int    `json:"count"` // lines of code
}

// Dependency is a single detected dependency entry.
type Dependency struct {
	Name    string `json:"name"`
	Version string `json:"version"`
	Source  string `json:"source"` // "npm" | "go" | "cargo"
}

// TopContributor is a contributor with their commit count.
type TopContributor struct {
	Author string `json:"author"`
	Count  int    `json:"count"`
}

// ActivityStat holds recent commit activity metrics for a repository.
type ActivityStat struct {
	TotalCommits   int    `json:"total_commits"`
	ActiveDays     int    `json:"active_days"`
	LastCommitDate string `json:"last_commit_date"`
	CommitRate30d  int    `json:"commit_rate_30d"` // commits in last 30 days
	ActiveMonths   int    `json:"active_months"`
}

// RepoKnowledge is the aggregated, mineable knowledge for one repository.
type RepoKnowledge struct {
	ReadmeExcerpt   string            `json:"readme_excerpt"`
	TechStack       []Tech            `json:"tech_stack"`
	Languages       []LanguageStat    `json:"languages"`
	Dependencies    []Dependency      `json:"dependencies,omitempty"`
	TopContributors []TopContributor  `json:"top_contributors,omitempty"`
	Activity        *ActivityStat     `json:"activity,omitempty"`
}
