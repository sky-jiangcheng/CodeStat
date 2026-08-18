package service

import (
	"encoding/json"
	"fmt"
	"log"
	"strconv"

	"gitboard/internal/db"
	"gitboard/internal/domain"
	"gitboard/internal/knowledge"
	"gitboard/internal/stats"
)

// defaultDailyCodeStandard is the fallback daily line standard used when the
// daily_code_standard config key is unset or unparsable.
const defaultDailyCodeStandard = 500

// ProjectResponse is the enriched project payload sent to the frontend.
type ProjectResponse struct {
	domain.Project
	RepoCount     int  `json:"repo_count"`
	TotalAdded    int  `json:"total_added"`
	TotalDeleted  int  `json:"total_deleted"`
	MyAdded       int  `json:"my_added"`
	MyDeleted     int  `json:"my_deleted"`
	MyFiles       int  `json:"my_files"`
	IsWorkday     bool `json:"is_workday"`
	BelowStandard bool `json:"below_standard"`
}

// RepoWithStats is a repository record with embedded daily stats.
type RepoWithStats struct {
	domain.Repository
	Stats []domain.DailyStat `json:"stats"`
}

// ProjectDetailResponse is the full project detail payload.
type ProjectDetailResponse struct {
	*domain.Project
	Repos []RepoWithStats `json:"repos"`
}

// LevelUpdateResult holds the result of a level change operation.
type LevelUpdateResult struct {
	Success  bool `json:"success"`
	NewLevel int  `json:"new_level"`
}

// dailyCodeStandard reads the configured daily line standard.
func (s *Service) dailyCodeStandard() int {
	v, _ := db.GetConfig(s.db, "daily_code_standard")
	n, _ := strconv.Atoi(v)
	if n == 0 {
		return defaultDailyCodeStandard
	}
	return n
}

// enrichProjects builds ProjectResponse entries (repo counts, personal vs
// total splits, workday standard check) for the given projects on a date.
func (s *Service) enrichProjects(projects []domain.Project, date string) []ProjectResponse {
	codeStd := s.dailyCodeStandard()
	isWorkday := s.git.IsWorkday(date)

	result := make([]ProjectResponse, 0, len(projects))
	for _, p := range projects {
		statsList, _ := db.GetStatsByProject(s.db, p.ID, date)
		repos, _ := db.GetRepositoriesByProjectID(s.db, p.ID)

		pr := ProjectResponse{
			Project:   p,
			RepoCount: len(repos),
			IsWorkday: isWorkday,
		}
		for _, st := range statsList {
			pr.TotalAdded += st.LinesAdded
			pr.TotalDeleted += st.LinesDeleted
			if st.Author == s.gitUser() {
				pr.MyAdded += st.LinesAdded
				pr.MyDeleted += st.LinesDeleted
				pr.MyFiles += st.FilesChanged
			}
		}
		pr.BelowStandard = isWorkday && pr.MyAdded < codeStd
		result = append(result, pr)
	}
	return result
}

// GetProjects returns enriched project summaries, optionally filtered by date
// and starred status. Triggers an on-demand single-day stats refresh for
// today/yesterday when a project has no rows yet.
func (s *Service) GetProjects(date string, starredOnly bool) []ProjectResponse {
	if date == "" {
		date = s.git.GetYesterdayDate()
	}
	if err := s.git.ValidateDate(date); err != nil {
		log.Printf("invalid date: %v", err)
		return nil
	}

	var projects []domain.Project
	var err error
	if starredOnly {
		projects, err = db.GetStarredProjects(s.db)
	} else {
		projects, err = db.GetAllProjects(s.db)
	}
	if err != nil {
		log.Printf("get projects error: %v", err)
		return nil
	}

	// Only auto-refresh for today or yesterday to avoid triggering git scans
	// on historical dates. Run it off the request path so the first open of
	// the dashboard/overview never blocks on git subprocesses; the next load
	// sees the back-filled rows.
	today := s.git.GetTodayDate()
	yesterday := s.git.GetYesterdayDate()
	if date == today || date == yesterday {
		go s.refreshMissingStatsForDate(projects, date)
	}

	return s.enrichProjects(projects, date)
}

// refreshMissingStatsForDate back-fills per-day stats for projects that have no
// row yet for date. Meant to run in its own goroutine (see GetProjects).
func (s *Service) refreshMissingStatsForDate(projects []domain.Project, date string) {
	for _, p := range projects {
		statsList, _ := db.GetStatsByProject(s.db, p.ID, date)
		if len(statsList) == 0 {
			if repos, _ := db.GetRepositoriesByProjectID(s.db, p.ID); len(repos) > 0 {
				s.refreshProjectStatsForDate(p.ID, date)
			}
		}
	}
}

// GetProjectDetail returns a project with all its repositories and stats.
func (s *Service) GetProjectDetail(id int64) (*ProjectDetailResponse, error) {
	project, err := db.GetProjectByID(s.db, id)
	if err != nil {
		return nil, fmt.Errorf("project not found")
	}
	repos, _ := db.GetRepositoriesByProjectID(s.db, id)

	repoList := make([]RepoWithStats, 0, len(repos))
	for _, repo := range repos {
		statsList, _ := db.GetStatsByRepositoryAndDate(s.db, repo.ID, "")
		if statsList == nil {
			statsList = []domain.DailyStat{}
		}
		repoList = append(repoList, RepoWithStats{Repository: repo, Stats: statsList})
	}
	return &ProjectDetailResponse{Project: project, Repos: repoList}, nil
}

// GetProjectStats returns daily stats for a project, optionally filtered by
// date, with the same on-demand refresh as GetProjects.
func (s *Service) GetProjectStats(id int64, date string) []domain.DailyStat {
	if date == "" {
		date = s.git.GetYesterdayDate()
	}
	if err := s.git.ValidateDate(date); err != nil {
		return nil
	}
	statsList, err := db.GetStatsByProject(s.db, id, date)
	if err != nil {
		log.Printf("get stats error: %v", err)
		return nil
	}
	// On-demand refresh runs in the background so this call never blocks on git.
	// The next load returns the back-filled rows.
	if len(statsList) == 0 {
		go s.refreshProjectStatsForDate(id, date)
	}
	return statsList
}

// UpdateProjectLevel adjusts a project's grouping: "down" splits a multi-repo
// project into per-repo projects, "up" merges sibling projects sharing the
// same parent directory into this one. Both run as a single transaction in
// the db layer.
func (s *Service) UpdateProjectLevel(id int64, direction string) (*LevelUpdateResult, error) {
	var newLevel int
	var err error
	switch direction {
	case "down":
		newLevel, err = db.SplitProjectDown(s.db, id)
	case "up":
		newLevel, err = db.MergeProjectUp(s.db, id)
	default:
		return nil, fmt.Errorf("direction must be 'up' or 'down'")
	}
	if err != nil {
		return nil, err
	}
	return &LevelUpdateResult{Success: true, NewLevel: newLevel}, nil
}

// ToggleStar flips the starred status of a project.
func (s *Service) ToggleStar(projectID int64) (bool, error) {
	return db.ToggleProjectStar(s.db, projectID)
}

// SearchProjects searches for projects by name or path and enriches the
// results with yesterday's stats.
func (s *Service) SearchProjects(query string) []ProjectResponse {
	projects, err := db.SearchProjects(s.db, query)
	if err != nil {
		log.Printf("search projects error: %v", err)
		return nil
	}
	return s.enrichProjects(projects, s.git.GetYesterdayDate())
}

// ProjectOverview is the mined-knowledge payload for a project detail page.
type ProjectOverview struct {
	ReadmeExcerpt   string                     `json:"readme_excerpt"`
	TechStack       []knowledge.Tech           `json:"tech_stack"`
	Languages       []knowledge.LanguageStat   `json:"languages"`
	Dependencies    []knowledge.Dependency     `json:"dependencies"`
	TopContributors []knowledge.TopContributor `json:"top_contributors"`
	Activity        *knowledge.ActivityStat    `json:"activity"`
	RecentCommits   []stats.RecentCommit       `json:"recent_commits"`
	Cached          bool                       `json:"cached"`
	Mining          bool                       `json:"mining,omitempty"`
}

// GetProjectOverview returns mined knowledge for a project: README excerpt,
// detected tech stack, language breakdown and recent commits. Mined results
// are cached in repo_meta so repeated loads do not re-walk the working tree.
func (s *Service) GetProjectOverview(projectID int64) (*ProjectOverview, error) {
	project, err := db.GetProjectByID(s.db, projectID)
	if err != nil {
		return nil, fmt.Errorf("project not found")
	}
	repos, _ := db.GetRepositoriesByProjectID(s.db, projectID)

	resp := &ProjectOverview{}

	// Cache is keyed by the first repo id when available.
	var cacheRepoID int64
	if len(repos) > 0 {
		cacheRepoID = repos[0].ID
	}
	if cacheRepoID > 0 {
		if meta, err := db.GetRepoMeta(s.db, cacheRepoID); err == nil && meta != nil && meta.TechStack != "" {
			_ = json.Unmarshal([]byte(meta.TechStack), &resp.TechStack)
			_ = json.Unmarshal([]byte(meta.Languages), &resp.Languages)
			_ = json.Unmarshal([]byte(meta.Dependencies), &resp.Dependencies)
			_ = json.Unmarshal([]byte(meta.TopContributors), &resp.TopContributors)
			_ = json.Unmarshal([]byte(meta.Activity), &resp.Activity)
			resp.ReadmeExcerpt = meta.ReadmeExcerpt
			resp.Cached = true
		}
	}

	// Mine fresh when no cache was found — trigger async so the API returns quickly.
	if !resp.Cached {
		resp.Mining = true
		go s.mineAndCache(cacheRepoID, project.RootPath, repos)
	}
	// Recent commits are always fresh.
	repoPaths := make([]string, 0, len(repos))
	for _, r := range repos {
		repoPaths = append(repoPaths, r.Path)
	}
	if commits, err := s.git.GetRecentCommits(repoPaths, s.gitUser(), 8); err == nil {
		resp.RecentCommits = commits
	}
	return resp, nil
}

// mineAndCache runs knowledge mining in the background and caches the result.
// It uses a sync.Map to skip duplicate mining requests for the same repo.
func (s *Service) mineAndCache(cacheRepoID int64, rootPath string, repos []domain.Repository) {
	// Dedup: if a mining goroutine is already running for this repo, skip.
	if cacheRepoID > 0 {
		if _, loaded := s.miningInFlight.LoadOrStore(cacheRepoID, true); loaded {
			return
		}
		defer s.miningInFlight.Delete(cacheRepoID)
	}
	minePath := rootPath
	if minePath == "" && len(repos) > 0 {
		minePath = repos[0].Path
	}
	if minePath == "" {
		return
	}
	k, err := knowledge.Mine(minePath)
	if err != nil || k == nil {
		return
	}
	if cacheRepoID > 0 {
		ts, _ := json.Marshal(k.TechStack)
		ls, _ := json.Marshal(k.Languages)
		ds, _ := json.Marshal(k.Dependencies)
		tc, _ := json.Marshal(k.TopContributors)
		aa, _ := json.Marshal(k.Activity)
		if err := db.UpsertRepoMeta(s.db, cacheRepoID, string(ts), k.ReadmeExcerpt, string(ls), string(ds), string(tc), string(aa)); err != nil {
			log.Printf("mineAndCache: upsert repo_meta for repo %d failed: %v", cacheRepoID, err)
		}
	}
}

// ProjectSummary is the compact project payload used by the CLI and the MCP
// server: the project record with its repositories.
type ProjectSummary struct {
	Project   *domain.Project     `json:"project"`
	Repos     []domain.Repository `json:"repos"`
	RepoCount int                 `json:"repo_count"`
}

// GetProjectSummary returns a project with its repositories for read-only
// consumers (CLI / MCP).
func (s *Service) GetProjectSummary(id int64) (*ProjectSummary, error) {
	project, err := db.GetProjectByID(s.db, id)
	if err != nil {
		return nil, err
	}
	repos, err := db.GetRepositoriesByProjectID(s.db, id)
	if err != nil {
		return nil, err
	}
	return &ProjectSummary{Project: project, Repos: repos, RepoCount: len(repos)}, nil
}

// ListProjects returns all projects for read-only consumers (CLI / MCP).
func (s *Service) ListProjects() []domain.Project {
	projects, err := db.GetAllProjects(s.db)
	if err != nil {
		log.Printf("list projects error: %v", err)
		return nil
	}
	return projects
}
