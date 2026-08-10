package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gitboard/internal/db"
	"gitboard/internal/platform"
)

func main() {
	dbPath := platform.GetDbPath()
	home, _ := os.UserHomeDir()
	parts := []string{}
	scores := []scoreEntry{}
	total := 0
	earned := 0

	// 1. Database health
	total++
	if _, err := os.Stat(dbPath); err == nil {
		d, err := db.InitDB(dbPath)
		if err == nil {
			defer d.Close()
			var count int
			d.QueryRow("SELECT COUNT(*) FROM project_notes").Scan(&count)
			if count > 0 {
				parts = append(parts, fmt.Sprintf("  ✅ Database OK — %d notes", count))
				scores = append(scores, scoreEntry{"database", true})
				earned++
			} else {
				parts = append(parts, "  ⚠️  Database OK but no notes (run scan first)")
				scores = append(scores, scoreEntry{"database", false})
			}
		} else {
			parts = append(parts, fmt.Sprintf("  ❌ Database error: %v", err))
			scores = append(scores, scoreEntry{"database", false})
		}
	} else {
		parts = append(parts, fmt.Sprintf("  ❌ Database not found at %s", dbPath))
		scores = append(scores, scoreEntry{"database", false})
	}

	// 2. Notes exist
	total++
	if d, err := db.InitDB(dbPath); err == nil {
		defer d.Close()
		var count int
		d.QueryRow("SELECT COUNT(*) FROM project_notes").Scan(&count)
		if count > 0 {
			parts = append(parts, fmt.Sprintf("  ✅ Notes exist: %d", count))
			scores = append(scores, scoreEntry{"notes_exist", true})
			earned++
		} else {
			parts = append(parts, "  ⚠️  No notes — import Claude memory or create some")
			scores = append(scores, scoreEntry{"notes_exist", false})
		}
	}

	// 3. Search works
	total++
	if d, err := db.InitDB(dbPath); err == nil {
		defer d.Close()
		hits, err := db.SearchAll(d, "test")
		if err == nil && hits != nil {
			parts = append(parts, "  ✅ Search (FTS5) operational")
			scores = append(scores, scoreEntry{"search", true})
			earned++
		} else {
			parts = append(parts, "  ⚠️  Search not available")
			scores = append(scores, scoreEntry{"search", false})
		}
	}

	// 4. Claude memory importable
	total++
	claudeMemory := filepath.Join(home, ".claude", "projects")
	if info, err := os.Stat(claudeMemory); err == nil && info.IsDir() {
		files, _ := filepath.Glob(filepath.Join(claudeMemory, "*", "memory", "*.md"))
		if len(files) > 0 {
			parts = append(parts, fmt.Sprintf("  ✅ Claude memory sources found: %d files", len(files)))
			scores = append(scores, scoreEntry{"claude_memory", true})
			earned++
		} else {
			parts = append(parts, "  ⚠️  Claude memory directory exists but no .md files")
			scores = append(scores, scoreEntry{"claude_memory", false})
		}
	} else {
		parts = append(parts, "  ⚠️  No Claude memory directory found")
		scores = append(scores, scoreEntry{"claude_memory", false})
	}

	// 5. GitBuddy CLI available
	total++
	cliPath, _ := os.Executable()
	if cliPath != "" && strings.Contains(cliPath, "gitboard") {
		parts = append(parts, "  ✅ CLI binary present")
		scores = append(scores, scoreEntry{"cli", true})
		earned++
	} else {
		parts = append(parts, "  ⚠️  CLI not found at "+cliPath)
		scores = append(scores, scoreEntry{"cli", false})
	}

	// 6. MCP server available
	total++
	mcpPath := filepath.Join(filepath.Dir(cliPath), "gitboard-mcp")
	if _, err := os.Stat(mcpPath); err == nil {
		parts = append(parts, "  ✅ MCP server binary present")
		scores = append(scores, scoreEntry{"mcp", true})
		earned++
	} else {
		// Check if it can be built
		parts = append(parts, "  ⚠️  MCP server not built — run: go build -o gitboard-mcp ./cmd/mcp/")
		scores = append(scores, scoreEntry{"mcp", false})
	}

	// 7. SKILL.md exists
	total++
	if _, err := os.Stat("SKILL.md"); err == nil {
		parts = append(parts, "  ✅ SKILL.md present")
		scores = append(scores, scoreEntry{"skill_md", true})
		earned++
	} else {
		parts = append(parts, "  ⚠️  SKILL.md not found in repo root")
		scores = append(scores, scoreEntry{"skill_md", false})
	}

	// 8. i18n locales
	total++
	locales := []string{"zh-CN", "en"}
	foundLocales := 0
	for _, loc := range locales {
		if _, err := os.Stat(filepath.Join("web", "src", "locales", loc, "common.json")); err == nil {
			foundLocales++
		}
	}
	if foundLocales >= len(locales) {
		parts = append(parts, fmt.Sprintf("  ✅ i18n: %d locale(s) found", foundLocales))
		scores = append(scores, scoreEntry{"i18n", true})
		earned++
	} else {
		parts = append(parts, fmt.Sprintf("  ⚠️  i18n incomplete: %d/%d locales", foundLocales, len(locales)))
		scores = append(scores, scoreEntry{"i18n", false})
	}

	// Print report
	fmt.Println("=== GitBuddy Agent Score ===")
	fmt.Println()
	for _, p := range parts {
		fmt.Println(p)
	}
	fmt.Println()
	fmt.Printf("Score: %d/%d\n", earned, total)
	pct := float64(earned) / float64(total) * 100
	fmt.Printf("AI-readiness: %.0f%%\n", pct)
	fmt.Println()

	if pct >= 75 {
		fmt.Println("✅ GitBuddy is agent-ready! MCP and CLI are functional.")
	} else if pct >= 50 {
		fmt.Println("⚠️  GitBuddy is partially ready. Review warnings above.")
	} else {
		fmt.Println("❌ GitBuddy needs setup before agents can use it effectively.")
	}
}

type scoreEntry struct {
	name  string
	pass  bool
}
