package main

import (
	"fmt"

	pluginruntime "gitboard/internal/core/plugin/runtime"
	"gitboard/internal/platform"

	"github.com/wailsapp/wails/v2/pkg/runtime"
)

// PluginStatus mirrors runtime.PluginStatus for the settings page.
type PluginStatus = pluginruntime.PluginStatus

// SourceStatus mirrors runtime.SourceStatus for the settings page.
type SourceStatus = pluginruntime.SourceStatus

// GetPluginStatuses returns the load status of every plugin directory.
func (a *App) GetPluginStatuses() []PluginStatus {
	if a.pluginRuntime == nil {
		return []PluginStatus{}
	}
	return a.pluginRuntime.PluginStatuses()
}

// GetKnowledgeSources returns registered knowledge importers with their state.
func (a *App) GetKnowledgeSources() []SourceStatus {
	if a.pluginRuntime == nil {
		return []SourceStatus{}
	}
	return a.pluginRuntime.SourceStatuses()
}

// emitImportEvent forwards an import result both to the plugin event bus and
// to the Wails frontend (for toast notifications), guarded by ctx availability.
func (a *App) emitImportEvent(name string, run pluginruntime.ImportRun, err error) {
	a.pluginRuntime.Emit("import.completed", map[string]any{
		"source": name, "created": run.Created, "updated": run.Updated, "skipped": run.Skipped,
	})
	if a.ctx != nil {
		payload := map[string]any{"source": name, "created": run.Created, "updated": run.Updated, "skipped": run.Skipped}
		if err != nil {
			payload["error"] = err.Error()
		}
		runtime.EventsEmit(a.ctx, "import.completed", payload)
	}
}

// TriggerKnowledgeImport runs the knowledge source registered under name and
// returns the import statistics.
func (a *App) TriggerKnowledgeImport(name string) (pluginruntime.ImportRun, error) {
	if a.pluginRuntime == nil {
		return pluginruntime.ImportRun{}, fmt.Errorf("plugin runtime not initialized")
	}
	run, err := a.pluginRuntime.TriggerImport(name)
	a.emitImportEvent(name, run, err)
	return run, err
}

// TriggerAllKnowledgeImports runs every registered knowledge source and emits
// an import.completed event for each, so the UI can surface per-source results.
func (a *App) TriggerAllKnowledgeImports() []pluginruntime.SourceRun {
	if a.pluginRuntime == nil {
		return []pluginruntime.SourceRun{}
	}
	results := a.pluginRuntime.ImportAll()
	for _, r := range results {
		var err error
		if r.Err != "" {
			err = fmt.Errorf("%s", r.Err)
		}
		a.emitImportEvent(r.Name, r.Run, err)
	}
	return results
}

// ReloadPlugins rescans the plugins directory and reloads every plugin.
func (a *App) ReloadPlugins() []PluginStatus {
	if a.pluginRuntime == nil {
		return []PluginStatus{}
	}
	a.pluginRuntime.Load(platform.GetPluginsDir())
	return a.pluginRuntime.PluginStatuses()
}
