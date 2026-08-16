package service

import (
	"encoding/json"
	"fmt"

	pluginruntime "gitboard/internal/core/plugin/runtime"
	"gitboard/internal/importers/claude"
	"gitboard/internal/platform"
)

// pluginsDir resolves the plugin directory; a thin seam over platform so the
// service package stays testable without touching the real config dir in unit
// tests that do not call Startup.
func pluginsDir() string { return platform.GetPluginsDir() }

// jsonUnmarshal decodes data into v, returning whether it succeeded. Cached
// repo_meta payloads may be legacy or empty; failures are non-fatal.
func jsonUnmarshal(data string, v any) bool {
	return json.Unmarshal([]byte(data), v) == nil
}

// GetPluginStatuses returns the load status of every plugin directory.
func (s *Service) GetPluginStatuses() []pluginruntime.PluginStatus {
	if s.rt == nil {
		return []pluginruntime.PluginStatus{}
	}
	return s.rt.PluginStatuses()
}

// GetKnowledgeSources returns registered knowledge importers with their state.
func (s *Service) GetKnowledgeSources() []pluginruntime.SourceStatus {
	if s.rt == nil {
		return []pluginruntime.SourceStatus{}
	}
	return s.rt.SourceStatuses()
}

// emitImportEvent forwards an import result both to the plugin event bus and
// to the registered UI handler (which forwards it to the frontend).
func (s *Service) emitImportEvent(name string, run pluginruntime.ImportRun, err error) {
	if s.rt != nil {
		s.rt.Emit("import.completed", map[string]any{
			"source": name, "created": run.Created, "updated": run.Updated, "skipped": run.Skipped,
		})
	}
	if s.onImportEvent != nil {
		payload := ImportEventPayload{"source": name, "created": run.Created, "updated": run.Updated, "skipped": run.Skipped}
		if err != nil {
			payload["error"] = err.Error()
		}
		s.onImportEvent(payload)
	}
}

// TriggerKnowledgeImport runs the knowledge source registered under name and
// returns the import statistics.
func (s *Service) TriggerKnowledgeImport(name string) (pluginruntime.ImportRun, error) {
	if s.rt == nil {
		return pluginruntime.ImportRun{}, fmt.Errorf("plugin runtime not initialized")
	}
	run, err := s.rt.TriggerImport(name)
	s.emitImportEvent(name, run, err)
	return run, err
}

// TriggerAllKnowledgeImports runs every registered knowledge source and emits
// an import.completed event for each, so the UI can surface per-source results.
func (s *Service) TriggerAllKnowledgeImports() []pluginruntime.SourceRun {
	if s.rt == nil {
		return []pluginruntime.SourceRun{}
	}
	results := s.rt.ImportAll()
	for _, r := range results {
		var err error
		if r.Err != "" {
			err = fmt.Errorf("%s", r.Err)
		}
		s.emitImportEvent(r.Name, r.Run, err)
	}
	return results
}

// ReloadPlugins rescans the plugins directory and reloads every plugin.
func (s *Service) ReloadPlugins() []pluginruntime.PluginStatus {
	if s.rt == nil {
		return []pluginruntime.PluginStatus{}
	}
	s.rt.Load(pluginsDir())
	return s.rt.PluginStatuses()
}

// registerClaudeImporter registers the built-in Claude memory importer with
// the plugin runtime so it appears in the knowledge-sources list and can be
// triggered through the shared TriggerImport path.
func (s *Service) registerClaudeImporter() {
	s.rt.RegisterSource(claude.SourceName, claude.New(s.db))
}

// ImportResult summarizes a Claude memory import run.
type ImportResult struct {
	Synced  int `json:"synced"`
	Updated int `json:"updated"`
	Skipped int `json:"skipped"`
}

// ImportClaudeMemory imports notes from Claude's per-project memory directory
// (~/.claude/projects/*/memory/*.md) into GitBuddy, matching each to a project
// by name or repository path. The import is delegated to the built-in Claude
// KnowledgeImporter through the plugin runtime, so it is idempotent and shares
// the same upsert and statistics path as script plugins (issue #35).
func (s *Service) ImportClaudeMemory() (*ImportResult, error) {
	if s.rt == nil {
		return &ImportResult{}, nil
	}
	run, err := s.rt.TriggerImport(claude.SourceName)
	if err != nil {
		return &ImportResult{}, err
	}
	return &ImportResult{
		Synced:  run.Created,
		Updated: run.Updated,
		Skipped: run.Skipped,
	}, nil
}
