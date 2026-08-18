// gitboard-agent-score reports how ready the local GitBuddy installation is
// for AI agents: database health, notes, FTS5 search, Claude memory sources,
// CLI/MCP binaries, SKILL.md and i18n locales.
package main

import (
	"fmt"
	"os"
	"path/filepath"
	"strings"

	"gitboard/internal/db"
	"gitboard/internal/platform"
	"gitboard/internal/service"
	"gitboard/internal/version"
)

func main() {
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

	dbPath := platform.GetDbPath()
	home, _ := os.UserHomeDir()

	// Open the database once (if present) and share it across checks.
	var svc *service.Service
	noteCount := 0
	if _, err := os.Stat(dbPath); err == nil {
		if d, err := db.InitDB(dbPath); err == nil {
			defer d.Close()
			svc = service.New(d, platform.GetGitUserName())
			notes := svc.ListAllNotes()
			noteCount = len(notes)
		}
	}

	// 1. Database health
	if svc != nil {
		if noteCount > 0 {
			parts = append(parts, fmt.Sprintf("  ✅ Database OK — %d notes", noteCount))
			record(true)
		} else {
			parts = append(parts, "  ⚠️  Database OK but no notes (run scan first)")
			record(false)
		}
	} else {
		parts = append(parts, fmt.Sprintf("  ❌ Database not found at %s", dbPath))
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
	if svc != nil {
		hits := svc.SearchAll("test")
		if hits != nil {
			parts = append(parts, "  ✅ Search (FTS5) operational")
			record(true)
		} else {
			parts = append(parts, "  ⚠️  Search not available")
			record(false)
		}
	} else {
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

	// 5. CLI binary available
	cliPath, _ := os.Executable()
	if cliPath != "" && (strings.Contains(cliPath, "gitboard") || strings.Contains(cliPath, "gitbuddy")) {
		parts = append(parts, "  ✅ CLI binary present")
		record(true)
	} else {
		parts = append(parts, "  ⚠️  CLI not found at "+cliPath)
		record(false)
	}

	// 6. MCP server available
	exeDir := filepath.Dir(cliPath)
	mcpFound := false
	for _, name := range []string{"gitbuddy-mcp", "gitboard-mcp"} {
		if _, err := os.Stat(filepath.Join(exeDir, name)); err == nil {
			mcpFound = true
			break
		}
	}
	if mcpFound {
		parts = append(parts, "  ✅ MCP server binary present")
		record(true)
	} else {
		parts = append(parts, "  ⚠️  MCP server not built — run: go build -o gitbuddy-mcp ./cmd/mcp/")
		record(false)
	}

	// 7. SKILL.md exists
	root := findRepoRoot()
	if _, err := os.Stat(filepath.Join(root, "SKILL.md")); err == nil {
		parts = append(parts, "  ✅ SKILL.md present")
		record(true)
	} else {
		parts = append(parts, "  ⚠️  SKILL.md not found in repo root")
		record(false)
	}

	// 8. i18n locales
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

	// Print report
	fmt.Printf("=== GitBuddy Agent Score (v%s) ===\n\n", version.Version)
	for _, p := range parts {
		fmt.Println(p)
	}
	fmt.Println()
	fmt.Printf("Score: %d/%d\n", earned, total)
	pct := float64(earned) / float64(total) * 100
	fmt.Printf("AI-readiness: %.0f%%\n\n", pct)

	if pct >= 75 {
		fmt.Println("✅ GitBuddy is agent-ready! MCP and CLI are functional.")
	} else if pct >= 50 {
		fmt.Println("⚠️  GitBuddy is partially ready. Review warnings above.")
	} else {
		fmt.Println("❌ GitBuddy needs setup before agents can use it effectively.")
	}
}

// findRepoRoot walks up from the executable's directory until it finds a
// directory containing SKILL.md (the repository root), so the score is not
// dependent on the caller's current working directory.
func findRepoRoot() string {
	exe, err := os.Executable()
	if err == nil {
		dir := filepath.Dir(exe)
		for {
			if _, err := os.Stat(filepath.Join(dir, "SKILL.md")); err == nil {
				return dir
			}
			parent := filepath.Dir(dir)
			if parent == dir {
				break
			}
			dir = parent
		}
	}
	// Fall back to the current directory when the executable is not useful.
	return "."
}
