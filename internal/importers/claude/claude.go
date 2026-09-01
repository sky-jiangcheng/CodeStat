// Package claude implements the built-in Claude memory KnowledgeImporter
// (issue #35). It reads notes from ~/.claude/projects/*/memory/*.md, matches
// each to a GitBuddy project by name or repository path, and produces
// plugin.ImportDoc values that the plugin runtime upserts into the knowledge
// base. Imports are idempotent: the runtime updates existing notes rather than
// duplicating them.
package claude

import (
	"database/sql"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gitbuddy/internal/core/plugin"
	"gitbuddy/internal/db"
)

// SourceName is the stable knowledge-source identifier registered by this
// importer.
const SourceName = "claude"

// Importer implements plugin.KnowledgeImporter for Claude memory files.
type Importer struct {
	db *sql.DB
}

// New creates a Claude memory importer bound to the application database.
func New(database *sql.DB) *Importer {
	return &Importer{db: database}
}

// Source returns the stable source identifier "claude".
func (i *Importer) Source() string { return SourceName }

// Import scans ~/.claude/projects/*/memory/*.md and returns documents to
// upsert. Files whose project cannot be matched to a GitBuddy project are
// returned with ProjectID 0, which the runtime counts as skipped.
func (i *Importer) Import() ([]plugin.ImportDoc, error) {
	home, err := os.UserHomeDir()
	if err != nil {
		return nil, fmt.Errorf("cannot resolve home directory")
	}
	claudeDir := filepath.Join(home, ".claude", "projects")
	entries, err := os.ReadDir(claudeDir)
	if err != nil {
		// No Claude memory directory yet; a successful no-op.
		return nil, nil
	}

	projects, _ := db.GetAllProjects(i.db)
	repos, _ := db.GetAllRepositories(i.db)

	var docs []plugin.ImportDoc
	for _, e := range entries {
		if !e.IsDir() {
			continue
		}
		memDir := filepath.Join(claudeDir, e.Name(), "memory")
		memEntries, err := os.ReadDir(memDir)
		if err != nil {
			continue
		}

		displayName := DisplayName(e.Name())
		if len(displayName) < 2 {
			continue
		}
		pid := MatchProject(displayName, projects, repos)

		for _, m := range memEntries {
			if m.IsDir() || !strings.HasSuffix(m.Name(), ".md") {
				continue
			}
			base := strings.TrimSuffix(m.Name(), ".md")
			if base == "MEMORY" {
				continue
			}
			raw, err := os.ReadFile(filepath.Join(memDir, m.Name()))
			if err != nil {
				continue
			}
			docs = append(docs, plugin.ImportDoc{
				ProjectID: pid, // 0 when no project matched -> skipped by runtime
				Title:     NoteTitle(base),
				Content:   StripFrontmatter(string(raw)),
				Kind:      "knowledge",
				Source:    SourceName,
			})
		}
	}
	return docs, nil
}

// DisplayName extracts the final path segment from a Claude project dir name
// like "-Users-name-Workspace-ProjectName" -> "ProjectName".
func DisplayName(dirName string) string {
	s := dirName
	if strings.HasPrefix(s, "-") {
		s = strings.TrimPrefix(s, "-")
	}
	parts := strings.Split(s, "-")
	return parts[len(parts)-1]
}

// NoteTitle maps a Claude memory filename to a human-readable note title.
func NoteTitle(filename string) string {
	switch filename {
	case "project":
		return "项目知识"
	case "user":
		return "用户信息"
	case "feedback":
		return "反馈记录"
	case "reference":
		return "参考信息"
	default:
		return filename
	}
}

// MatchProject finds the GitBuddy project id for a Claude memory dir,
// preferring exact name, then repo path suffix, then name containment.
// Returns 0 when no project matches.
func MatchProject(displayName string, projects []db.Project, repos []db.Repository) int64 {
	lower := strings.ToLower(displayName)
	// 1. exact name
	for _, p := range projects {
		if p.Name == displayName {
			return p.ID
		}
	}
	// 2. repository path ending with /displayName
	for _, r := range repos {
		rp := strings.ToLower(r.Path)
		if strings.HasSuffix(rp, "/"+lower) || strings.HasSuffix(rp, "/"+lower+".git") {
			if r.ProjectID != nil {
				return *r.ProjectID
			}
		}
	}
	// 3. project name containment
	for _, p := range projects {
		if strings.Contains(strings.ToLower(p.Name), lower) {
			return p.ID
		}
	}
	return 0
}

// StripFrontmatter removes a leading YAML frontmatter block (between --- markers
// on their own lines) from a markdown string. If no frontmatter is present, the
// input is returned as-is. Only considers the very first two lines for each marker
// to avoid being fooled by horizontal rules later in the text.
func StripFrontmatter(s string) string {
	s = strings.TrimSpace(s)
	if !strings.HasPrefix(s, "---") {
		return s
	}
	// Find the end of the first line containing the opening "---"
	idx := strings.Index(s, "\n")
	if idx < 0 {
		return s // no newline after "---", not valid frontmatter
	}
	// Check if the first line is exactly "---" (optional trailing whitespace)
	firstLine := strings.TrimSpace(s[:idx])
	if firstLine != "---" {
		return s
	}
	// Look for closing "---" on a line by itself
	remainder := s[idx+1:]
	lines := strings.Split(remainder, "\n")
	for i, line := range lines {
		if strings.TrimSpace(line) == "---" {
			// Return everything after this closing marker line
			if i+1 < len(lines) {
				return strings.TrimLeft(strings.Join(lines[i+1:], "\n"), "\r\n")
			}
			return ""
		}
	}
	// No closing marker found; return the remainder as-is.
	return strings.TrimLeft(remainder, "\r\n")
}
