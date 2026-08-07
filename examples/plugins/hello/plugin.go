//go:build ignore

// hello is a minimal GitBuddy plugin. Copy this directory into the plugins
// dir (platform.GetPluginsDir: <config>/gitboard/plugins/hello/) to load it.
//
// A plugin is a single plugin.go file. Required exports:
//   - Name() string
//   - Init(ctx *plugin.Context) error
//
// Optional exports:
//   - Source() string                              default: Name()
//   - Import(ctx *plugin.Context) ([]plugin.ImportDoc, error)
//
// The script imports "gitboard/internal/core/plugin" for the host-provided
// types. A panicking plugin never crashes GitBuddy: the runtime recovers and
// records the error on the settings page.
package main

import "gitboard/internal/core/plugin"

// Name returns the stable plugin identifier shown in the settings page.
func Name() string { return "hello" }

// Init registers event handlers. Available events include:
//   - "note.created"
//   - "project.scanned"
//   - "import.completed"
func Init(ctx *plugin.Context) error {
	ctx.On("note.created", func(e plugin.Event) error {
		return nil
	})
	return nil
}
