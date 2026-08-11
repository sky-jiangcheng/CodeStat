package main

import (
	"fmt"
	"log"
	"strings"
	"time"

	"gitboard/internal/db"
)

// SummaryData holds the daily summary payload.
type SummaryData struct {
	Date         string `json:"date"`
	RepoCount    int    `json:"repo_count"`
	TotalFiles   int    `json:"total_files"`
	TotalAdded   int    `json:"total_added"`
	TotalDeleted int    `json:"total_deleted"`
	MyAdded      int    `json:"my_added"`
	MyDeleted    int    `json:"my_deleted"`
	MyFiles      int    `json:"my_files"`
	IsWorkday    bool   `json:"is_workday"`
}

// GetSummary returns aggregated stats for all repositories on a given date.
func (a *App) GetSummary(date string) (*SummaryData, error) {
	if date == "" {
		date = a.Git.GetYesterdayDate()
	}
	if err := a.Git.ValidateDate(date); err != nil {
		return nil, fmt.Errorf("invalid date format")
	}

	allStats, err := a.Stores.DailyStat.GetByDate(date)
	if err != nil {
		return nil, fmt.Errorf("failed to load summary")
	}

	summary := &SummaryData{Date: date, IsWorkday: a.Git.IsWorkday(date)}
	repoSet := make(map[int64]bool)
	for _, st := range allStats {
		repoSet[st.RepositoryID] = true
		summary.TotalFiles += st.FilesChanged
		summary.TotalAdded += st.LinesAdded
		summary.TotalDeleted += st.LinesDeleted
		if st.Author == a.gitUser {
			summary.MyAdded += st.LinesAdded
			summary.MyDeleted += st.LinesDeleted
			summary.MyFiles += st.FilesChanged
		}
	}
	summary.RepoCount = len(repoSet)
	return summary, nil
}

// HeatmapResponse holds heatmap data for the frontend.
type HeatmapResponse struct {
	Days []db.HeatmapDay `json:"days"`
}

// GetHeatmapData returns daily commit stats for the past year.
func (a *App) GetHeatmapData() *HeatmapResponse {
	endDate := a.Git.GetTodayDate()
	startDate := time.Now().AddDate(0, 0, -365).Format("2006-01-02")

	days, err := a.Stores.DailyStat.GetHeatmap(startDate, endDate, a.gitUser)
	if err != nil {
		log.Printf("get heatmap error: %v", err)
		return &HeatmapResponse{Days: []db.HeatmapDay{}}
	}
	if days == nil {
		days = []db.HeatmapDay{}
	}
	return &HeatmapResponse{Days: days}
}

// StatusBarData holds real-time status information.
type StatusBarData struct {
	CurrentTime      string `json:"current_time"`
	LastCommitTime   string `json:"last_commit_time"`
	LastCommitRepo   string `json:"last_commit_repo"`
	LastCommitBranch string `json:"last_commit_branch"`
	LastCommitMsg    string `json:"last_commit_msg"`
}

// statusCacheTTL is how long the status bar cache lasts before refreshing.
const statusCacheTTL = 30 * time.Second

// GetStatusBar returns current status bar information with 30-second caching
// to avoid running git log on every UI render. Uses double-check locking to
// avoid holding the mutex during the (potentially slow) git command.
func (a *App) GetStatusBar() *StatusBarData {
	a.statusCacheMu.Lock()
	if a.statusCache != nil && time.Now().Sub(a.statusCacheTime) < statusCacheTTL {
		cached := a.statusCache
		a.statusCacheMu.Unlock()
		return cached
	}
	a.statusCacheMu.Unlock()

	repos, _ := a.Stores.Repository.GetAll()
	repoPaths := make([]string, 0, len(repos))
	for _, r := range repos {
		repoPaths = append(repoPaths, r.Path)
	}

	now := time.Now()
	data := &StatusBarData{
		CurrentTime: now.Format("2006-01-02 15:04:05"),
	}

	recent, err := a.Git.GetRecentCommit(repoPaths, a.gitUser)
	if err == nil && recent != nil {
		data.LastCommitTime = recent.Time
		data.LastCommitRepo = pathBase(recent.Repo)
		data.LastCommitBranch = recent.Branch
		data.LastCommitMsg = recent.Message
	}

	a.statusCacheMu.Lock()
	a.statusCache = data
	a.statusCacheTime = now
	a.statusCacheMu.Unlock()
	return data
}

// GetTodoCounts returns incomplete and total todo counts per project.
func (a *App) GetTodoCounts() []db.TodoCount {
	counts, err := a.Stores.Todo.Counts()
	if err != nil {
		log.Printf("get todo counts error: %v", err)
		return nil
	}
	if counts == nil {
		counts = []db.TodoCount{}
	}
	return counts
}

// GetNoteCounts returns the count of notes per project.
func (a *App) GetNoteCounts() []db.NoteCount {
	counts, err := a.Stores.Note.Counts()
	if err != nil {
		log.Printf("get note counts error: %v", err)
		return nil
	}
	if counts == nil {
		counts = []db.NoteCount{}
	}
	return counts
}

// SearchHit is the unified search result type exposed to the frontend.
type SearchHit = db.SearchHit

// SearchNotes searches note content/title/tags across all projects,
// returning ranked hits with context snippets.
func (a *App) SearchNotes(query string) []SearchHit {
	if strings.TrimSpace(query) == "" {
		return nil
	}
	results, err := a.Stores.Search.Notes(query)
	if err != nil {
		log.Printf("search notes error: %v", err)
		return nil
	}
	if results == nil {
		results = []db.SearchHit{}
	}
	return results
}

// SearchAll searches notes and todos together, returning ranked unified hits.
func (a *App) SearchAll(query string) []SearchHit {
	if strings.TrimSpace(query) == "" {
		return nil
	}
	results, err := a.Stores.Search.All(query)
	if err != nil {
		log.Printf("search all error: %v", err)
		return nil
	}
	if results == nil {
		results = []db.SearchHit{}
	}
	return results
}

// ExportProjectStats returns all stats in CSV format suitable for spreadsheet import.
func (a *App) ExportProjectStats(projectID int64) string {
	statsList, err := a.Stores.DailyStat.GetByProject(projectID, "")
	if err != nil {
		return ""
	}
	if len(statsList) == 0 {
		a.refreshProjectStats(projectID, "")
		statsList, _ = a.Stores.DailyStat.GetByProject(projectID, "")
	}

	var sb strings.Builder
	sb.WriteString("date,author,files_changed,lines_added,lines_deleted\n")
	for _, st := range statsList {
		sb.WriteString(fmt.Sprintf("%s,%s,%d,%d,%d\n",
			st.StatDate, csvSafe(st.Author), st.FilesChanged, st.LinesAdded, st.LinesDeleted))
	}
	return sb.String()
}

// ExportHeatmapCSV returns heatmap data as CSV for spreadsheet use.
func (a *App) ExportHeatmapCSV() string {
	days := a.GetHeatmapData().Days
	var sb strings.Builder
	sb.WriteString("date,lines_added,lines_deleted,commits\n")
	for _, d := range days {
		sb.WriteString(fmt.Sprintf("%s,%d,%d,%d\n", d.Date, d.LinesAdded, d.LinesDeleted, d.Commits))
	}
	return sb.String()
}
