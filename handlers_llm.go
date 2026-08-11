package main

import (
	"fmt"
	"log"
	"strings"

	"gitboard/internal/db"
)

// LLMsTxtProject is a single project entry in the generated llms.txt payload.
type LLMsTxtProject struct {
	Name          string   `json:"name"`
	RootPath      string   `json:"root_path"`
	TechStack     []string `json:"tech_stack"`
	ReadmeExcerpt string   `json:"readme_excerpt"`
	NoteCount     int      `json:"note_count"`
}

// GenerateLLMsTxt returns an aggregated Markdown document suitable for AI
// consumption. It contains a project catalog, recent knowledge notes, and a
// structured summary of the local codebase knowledge base.
func (a *App) GenerateLLMsTxt() string {
	projects, err := db.GetAllProjects(a.db)
	if err != nil {
		log.Printf("generate llms.txt projects error: %v", err)
		projects = []db.Project{}
	}

	noteCounts, err := db.GetNoteCounts(a.db)
	if err != nil {
		log.Printf("generate llms.txt note counts error: %v", err)
		noteCounts = []db.NoteCount{}
	}
	countByProject := make(map[int64]int, len(noteCounts))
	for _, nc := range noteCounts {
		countByProject[nc.ProjectID] = nc.Count
	}

	metaByRepo := make(map[int64]db.RepoMeta)
	repos, err := db.GetAllRepositories(a.db)
	if err != nil {
		log.Printf("generate llms.txt repos error: %v", err)
		repos = []db.Repository{}
	}
	for _, r := range repos {
		if r.ProjectID == nil {
			continue
		}
		if _, ok := metaByRepo[*r.ProjectID]; ok {
			continue
		}
		if meta, err := db.GetRepoMeta(a.db, r.ID); err == nil && meta != nil {
			metaByRepo[*r.ProjectID] = *meta
		}
	}

	var b strings.Builder
	b.WriteString("# GitBuddy Knowledge Base\n\n")
	b.WriteString("This file is an AI-readable summary of the local GitBuddy knowledge base. ")
	b.WriteString("It catalogs discovered projects, their inferred technology stacks, README excerpts, and notable knowledge notes.\n\n")

	// Project catalog
	b.WriteString("## Projects\n\n")
	for _, p := range projects {
		count := countByProject[p.ID]
		b.WriteString(fmt.Sprintf("### %s\n\n", p.Name))
		b.WriteString(fmt.Sprintf("- Root path: `%s`\n", p.RootPath))
		b.WriteString(fmt.Sprintf("- Notes: %d\n", count))

			if meta, ok := metaByRepo[p.ID]; ok {
				if meta.TechStack != "" && meta.TechStack != "[]" {
					var techs []string
					jsonUnmarshalSafe(meta.TechStack, &techs)
					if len(techs) > 0 {
						b.WriteString(fmt.Sprintf("- Tech stack: %s\n", strings.Join(techs, ", ")))
					}
				}
			if meta.ReadmeExcerpt != "" {
				excerpt := meta.ReadmeExcerpt
				if len(excerpt) > 400 {
					excerpt = excerpt[:400] + "..."
				}
				b.WriteString(fmt.Sprintf("- README excerpt: %s\n", excerpt))
			}
		}
		b.WriteString("\n")
	}

	// Recent knowledge notes
	notes, err := db.ListAllNotes(a.db)
	if err != nil {
		log.Printf("generate llms.txt notes error: %v", err)
		notes = []db.NoteWithProject{}
	}
	b.WriteString("## Recent Knowledge Notes\n\n")
	shown := 0
	for _, n := range notes {
		if n.Kind != "knowledge" {
			continue
		}
		b.WriteString(fmt.Sprintf("### %s\n\n", firstNonEmpty(n.Title, "Untitled")))
		b.WriteString(fmt.Sprintf("- Project: %s\n", n.ProjectName))
		b.WriteString(fmt.Sprintf("- Tags: %s\n", n.Tags))
		b.WriteString(fmt.Sprintf("- Updated: %s\n\n", n.UpdatedAt))
		content := strings.TrimSpace(n.Content)
		if len(content) > 1000 {
			content = content[:1000] + "\n\n..."
		}
		b.WriteString(content)
		b.WriteString("\n\n---\n\n")
		shown++
		if shown >= 20 {
			break
		}
	}
	if shown == 0 {
		b.WriteString("_No knowledge notes found. Create notes with kind = 'knowledge' to populate this section._\n\n")
	}

	return b.String()
}

// ExportNoteAsMarkdown returns a single note as a Markdown file with YAML
// frontmatter, suitable for export or serving at a `.md` route.
func (a *App) ExportNoteAsMarkdown(noteID int64) string {
	note, err := db.GetNoteByID(a.db, noteID)
	if err != nil {
		log.Printf("export note markdown error: %v", err)
		return ""
	}
	projectName := ""
	if p, err := db.GetProjectByID(a.db, note.ProjectID); err == nil && p != nil {
		projectName = p.Name
	}

	var b strings.Builder
	b.WriteString("---\n")
	b.WriteString(fmt.Sprintf("title: %q\n", note.Title))
	b.WriteString(fmt.Sprintf("tags: %q\n", note.Tags))
	b.WriteString(fmt.Sprintf("kind: %q\n", note.Kind))
	b.WriteString(fmt.Sprintf("project: %q\n", projectName))
	b.WriteString(fmt.Sprintf("source: %q\n", note.Source))
	b.WriteString(fmt.Sprintf("updated_at: %q\n", note.UpdatedAt))
	b.WriteString("---\n\n")
	b.WriteString(note.Content)
	b.WriteString("\n")
	return b.String()
}
