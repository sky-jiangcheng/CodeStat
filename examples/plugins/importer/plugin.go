//go:build ignore

// importer is an example knowledge-source plugin. Copy this directory into
// the plugins dir as <config>/gitbuddy/plugins/importer/ and it will appear
// under Settings > Plugins > 知识导入源, where you can trigger the import.
package main

import "gitboard/internal/core/plugin"

// Name returns the stable plugin identifier.
func Name() string { return "importer" }

// Source names the knowledge source (defaults to Name() when absent).
func Source() string { return "example" }

// Init is called once at startup.
func Init(ctx *plugin.Context) error {
	return nil
}

// Import returns documents to upsert into the knowledge base. Set ProjectID
// to 0 to skip a document (the runtime counts it as skipped). The runtime is
// idempotent: re-importing updates notes with the same (project, source, title).
func Import(ctx *plugin.Context) ([]plugin.ImportDoc, error) {
	return []plugin.ImportDoc{
		{
			ProjectID: 0, // 0 -> skipped; use a real project id to import
			Title:     "hello note",
			Content:   "Imported by the example plugin.",
			Kind:      "knowledge",
		},
	}, nil
}
