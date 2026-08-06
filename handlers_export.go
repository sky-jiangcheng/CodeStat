package main

import (
	"encoding/json"
	"fmt"
	"os"
	"strings"
	"time"

	"github.com/wailsapp/wails/v2/pkg/runtime"

	"gitbuddy/internal/db"
)

// ExportFormat is the user-chosen output format for a data export.
type ExportFormat string

const (
	ExportMarkdown ExportFormat = "markdown"
	ExportJSON     ExportFormat = "json"
)

// ExportResult holds the outcome of an export operation.
type ExportResult struct {
	Success  bool   `json:"success"`
	Path     string `json:"path"`
	Notes    int    `json:"notes"`
	Todos    int    `json:"todos"`
	Message  string `json:"message,omitempty"`
}

// ExportNotes opens a save dialog and exports all notes (across all projects)
// in the chosen format. Markdown produces a single .md file with notes grouped
// by project; JSON produces a structured .json file containing notes and todos.
func (a *App) ExportNotes(format string) (*ExportResult, error) {
	f := ExportFormat(strings.ToLower(strings.TrimSpace(format)))
	if f != ExportMarkdown && f != ExportJSON {
		f = ExportMarkdown
	}

	notes, err := db.ListAllNotes(a.db)
	if err != nil {
		return nil, fmt.Errorf("failed to load notes: %w", err)
	}

	ext := ".md"
	if f == ExportJSON {
		ext = ".json"
	}
	defaultName := fmt.Sprintf("gitbuddy-notes-%s%s", time.Now().Format("2006-01-02"), ext)

	path, err := runtime.SaveFileDialog(a.ctx, runtime.SaveDialogOptions{
		DefaultFilename: defaultName,
		Title:           "导出笔记",
		Filters: []runtime.FileFilter{
			{DisplayName: strings.ToUpper(strings.TrimPrefix(ext, ".")) + " 文件", Pattern: "*" + ext},
		},
	})
	if err != nil || path == "" {
		return &ExportResult{Success: false, Message: "取消导出"}, nil
	}

	var content []byte
	todoCount := 0
	if f == ExportMarkdown {
		content = []byte(buildNotesMarkdown(notes))
	} else {
		// JSON export includes todos too for completeness.
		todos, terr := db.ListAllTodos(a.db)
		if terr == nil {
			todoCount = len(todos)
		}
		content, err = buildExportJSON(notes, todos)
		if err != nil {
			return nil, fmt.Errorf("failed to encode JSON: %w", err)
		}
	}

	if err := os.WriteFile(path, content, 0644); err != nil {
		return nil, fmt.Errorf("failed to write file: %w", err)
	}

	return &ExportResult{
		Success: true,
		Path:    path,
		Notes:   len(notes),
		Todos:   todoCount,
	}, nil
}

// buildNotesMarkdown renders all notes into a single Markdown document,
// grouped by project with metadata headers.
func buildNotesMarkdown(notes []db.NoteWithProject) string {
	var sb strings.Builder
	sb.WriteString("# GitBuddy 笔记导出\n\n")
	sb.WriteString(fmt.Sprintf("> 导出时间：%s\n", time.Now().Format("2006-01-02 15:04:05")))
	sb.WriteString(fmt.Sprintf("> 笔记总数：%d\n\n---\n\n", len(notes)))

	// Group notes by project name.
	byProject := make(map[string][]db.NoteWithProject)
	var projectOrder []string
	for _, n := range notes {
		if _, exists := byProject[n.ProjectName]; !exists {
			projectOrder = append(projectOrder, n.ProjectName)
		}
		byProject[n.ProjectName] = append(byProject[n.ProjectName], n)
	}

	for i, proj := range projectOrder {
		if i > 0 {
			sb.WriteString("\n---\n\n")
		}
		sb.WriteString(fmt.Sprintf("## %s\n\n", proj))
		for _, n := range byProject[proj] {
			title := n.Title
			if title == "" {
				title = strings.SplitN(n.Content, "\n", 2)[0]
			}
			if title == "" {
				title = "无标题"
			}
			sb.WriteString(fmt.Sprintf("### %s\n\n", title))
			// Metadata line.
			var meta []string
			if n.Kind != "" {
				meta = append(meta, "类型: "+n.Kind)
			}
			if n.Tags != "" {
				meta = append(meta, "标签: "+n.Tags)
			}
			if n.Pinned {
				meta = append(meta, "⭐ 已置顶")
			}
			meta = append(meta, "更新: "+n.UpdatedAt)
			if len(meta) > 0 {
				sb.WriteString("> " + strings.Join(meta, " · ") + "\n\n")
			}
			sb.WriteString(n.Content)
			sb.WriteString("\n\n")
		}
	}
	return sb.String()
}

// exportPayload is the JSON structure for the JSON export format.
type exportPayload struct {
	ExportedAt string                `json:"exported_at"`
	Notes      []db.NoteWithProject  `json:"notes"`
	Todos      []db.TodoWithProject  `json:"todos,omitempty"`
}

func buildExportJSON(notes []db.NoteWithProject, todos []db.TodoWithProject) ([]byte, error) {
	payload := exportPayload{
		ExportedAt: time.Now().Format(time.RFC3339),
		Notes:      notes,
		Todos:      todos,
	}
	return json.MarshalIndent(payload, "", "  ")
}
