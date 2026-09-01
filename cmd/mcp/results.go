package main

import (
	"encoding/json"
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"

	"gitboard/internal/service"
	"gitboard/internal/version"
)

func makeTextResult(text string) *mcp.CallToolResult {
	return mcp.NewToolResultText(text)
}

func makeJSONResult(name string, data any) (*mcp.CallToolResult, error) {
	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return makeTextResult(fmt.Sprintf("marshal error: %v", err)), nil
	}
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			mcp.TextContent{Type: "text", Text: string(bytes)},
		},
	}, nil
}

func runAgentScore(svc *service.Service) string {
	home, _ := os.UserHomeDir()
	parts := []string{}
	scores := []bool{}
	total := 0
	earned := 0

	record := func(ok bool) {
		scores = append(scores, ok)
		total++
		if ok {
			earned++
		}
	}

	// 1. Database health + notes count
	notes := svc.ListAllNotes()
	noteCount := len(notes)
	if noteCount > 0 {
		parts = append(parts, fmt.Sprintf("  ✅ Database OK — %d notes", noteCount))
		record(true)
	} else {
		parts = append(parts, "  ⚠️  Database OK but no notes (run scan first)")
		record(false)
	}

	// 2. Notes exist
	if noteCount > 0 {
		parts = append(parts, fmt.Sprintf("  ✅ Notes exist: %d", noteCount))
		record(true)
	} else {
		parts = append(parts, "  ⚠️  No notes — import Claude memory or create some")
		record(false)
	}

	// 3. Search works
	hits := svc.SearchAll("test")
	if hits != nil {
		parts = append(parts, "  ✅ Search (FTS5) operational")
		record(true)
	} else {
		parts = append(parts, "  ⚠️  Search not available")
		record(false)
	}

	// 4. Claude memory importable
	claudeMemory := filepath.Join(home, ".claude", "projects")
	if info, err := os.Stat(claudeMemory); err == nil && info.IsDir() {
		files, _ := filepath.Glob(filepath.Join(claudeMemory, "*", "memory", "*.md"))
		if len(files) > 0 {
			parts = append(parts, fmt.Sprintf("  ✅ Claude memory sources found: %d files", len(files)))
			record(true)
		} else {
			parts = append(parts, "  ⚠️  Claude memory directory exists but no .md files")
			record(false)
		}
	} else {
		parts = append(parts, "  ⚠️  No Claude memory directory found")
		record(false)
	}

	// 5. llms.txt export works
	if txt := svc.GenerateLLMsTxt(); len(txt) > 0 {
		parts = append(parts, "  ✅ llms.txt export generates content")
		record(true)
	} else {
		parts = append(parts, "  ⚠️  llms.txt export returned empty")
		record(false)
	}

	// 6. SKILL.md exists
	root := "."
	if exe, err := os.Executable(); err == nil {
		dir := filepath.Dir(exe)
		for {
			if _, err := os.Stat(filepath.Join(dir, "SKILL.md")); err == nil {
				root = dir
				break
			}
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}
	if _, err := os.Stat(filepath.Join(root, "SKILL.md")); err == nil {
		parts = append(parts, "  ✅ SKILL.md present")
		record(true)
	} else {
		parts = append(parts, "  ⚠️  SKILL.md not found in repo root")
		record(false)
	}

	// 7. i18n locales
	locales := []string{"zh-CN", "en"}
	foundLocales := 0
	for _, loc := range locales {
		if _, err := os.Stat(filepath.Join(root, "web", "src", "locales", loc, "common.json")); err == nil {
			foundLocales++
		}
	}
	if foundLocales >= len(locales) {
		parts = append(parts, fmt.Sprintf("  ✅ i18n: %d locale(s) found", foundLocales))
		record(true)
	} else {
		parts = append(parts, fmt.Sprintf("  ⚠️  i18n incomplete: %d/%d locales", foundLocales, len(locales)))
		record(false)
	}

	// Build report
	var sb strings.Builder
	fmt.Fprintf(&sb, "=== GitBuddy Agent Score (v%s) ===\n\n", version.Version)
	for _, p := range parts {
		fmt.Fprintln(&sb, p)
	}
	fmt.Fprintln(&sb)
	fmt.Fprintf(&sb, "Score: %d/%d\n", earned, total)
	pct := float64(earned) / float64(total) * 100
	fmt.Fprintf(&sb, "AI-readiness: %.0f%%\n\n", pct)

	if pct >= 75 {
		fmt.Fprintln(&sb, "✅ GitBuddy is agent-ready! MCP and tools are functional.")
	} else if pct >= 50 {
		fmt.Fprintln(&sb, "⚠️  GitBuddy is partially ready. Review warnings above.")
	} else {
		fmt.Fprintln(&sb, "❌ GitBuddy needs setup before agents can use it effectively.")
	}
	return sb.String()
}
