package main

import (
	"gitboard/internal/importers/claude"
)

// ImportResult summarizes a Claude memory import run.
type ImportResult struct {
	Synced  int `json:"synced"`
	Updated int `json:"updated"`
	Skipped int `json:"skipped"`
}

// registerClaudeImporter registers the built-in Claude memory importer with
// the plugin runtime so it appears in the knowledge-sources list and can be
// triggered through the shared TriggerImport path.
func (a *App) registerClaudeImporter() {
	a.pluginRuntime.RegisterSource(claude.SourceName, claude.New(a.db))
}

// ImportClaudeMemory imports notes from Claude's per-project memory directory
// (~/.claude/projects/*/memory/*.md) into GitBuddy, matching each to a project
// by name or repository path. The import is delegated to the built-in Claude
// KnowledgeImporter through the plugin runtime, so it is idempotent and shares
// the same upsert and statistics path as script plugins (issue #35).
func (a *App) ImportClaudeMemory() (*ImportResult, error) {
	if a.pluginRuntime == nil {
		return &ImportResult{}, nil
	}
	run, err := a.pluginRuntime.TriggerImport(claude.SourceName)
	if err != nil {
		return &ImportResult{}, err
	}
	return &ImportResult{
		Synced:  run.Created,
		Updated: run.Updated,
		Skipped: run.Skipped,
	}, nil
}
