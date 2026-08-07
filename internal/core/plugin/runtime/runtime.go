// Package runtime implements the in-process plugin runtime for GitBuddy.
//
// Plugins are Go scripts loaded via the yaegi interpreter (see ADR 0002 and
// issue #33). Each plugin lives in its own directory under the plugins dir
// (platform.GetPluginsDir) and must contain a plugin.go file exporting:
//
//	func Name() string                                     // required
//	func Init(ctx *plugin.Context) error                   // required
//	func Source() string                                   // optional, defaults to Name
//	func Import(ctx *plugin.Context) ([]plugin.ImportDoc, error) // optional knowledge source
//
// Scripts import "gitboard/internal/core/plugin" for the host-provided types.
// All plugin calls are wrapped in recover() so a panicking plugin can never
// crash the host process.
package runtime

import (
	"database/sql"
	"fmt"
	"log"
	"os"
	"path/filepath"
	"sync"

	"gitboard/internal/core/plugin"
	"gitboard/internal/db"
)

// PluginStatus describes the load result of one plugin, surfaced on the
// settings page so failures are visible instead of silent.
type PluginStatus struct {
	Name   string `json:"name"`
	Path   string `json:"path"`
	Loaded bool   `json:"loaded"`
	Err    string `json:"error,omitempty"`
}

// SourceStatus describes a registered knowledge source for the settings page.
type SourceStatus struct {
	Name    string `json:"name"`
	Plugin  string `json:"plugin"`
	Enabled bool   `json:"enabled"`
}

// sourceEntry is a registered knowledge importer with its latest run result.
type sourceEntry struct {
	name     string
	plugin   string
	importFn func() ([]plugin.ImportDoc, error)
	imported int
	lastErr  error
}

// Runtime loads and supervises plugins. It is safe for concurrent use.
type Runtime struct {
	mu       sync.Mutex
	db       *sql.DB
	plugins  []PluginStatus
	handlers map[string][]plugin.EventHandler
	sources  map[string]*sourceEntry
}

// New creates a Runtime bound to the given database handle.
func New(database *sql.DB) *Runtime {
	return &Runtime{
		db:       database,
		handlers: make(map[string][]plugin.EventHandler),
		sources:  make(map[string]*sourceEntry),
	}
}

// Load scans dir for plugin directories (dir/*/) and loads each one.
// A missing directory is not an error: no plugins are loaded.
func (r *Runtime) Load(dir string) {
	entries, err := os.ReadDir(dir)
	if err != nil {
		log.Printf("plugin runtime: plugins dir %s unavailable (%v); skipping", dir, err)
		return
	}

	var pending []string
	for _, e := range entries {
		if e.IsDir() {
			pending = append(pending, filepath.Join(dir, e.Name()))
		}
	}

	r.mu.Lock()
	r.plugins = nil
	r.handlers = make(map[string][]plugin.EventHandler)
	r.sources = make(map[string]*sourceEntry)
	r.mu.Unlock()

	for _, p := range pending {
		r.loadPlugin(p)
	}
	log.Printf("plugin runtime: loaded %d plugin(s)", len(r.plugins))
}

// loadPlugin loads a single plugin directory. Any panic during eval or init
// is recovered and recorded instead of propagating.
func (r *Runtime) loadPlugin(dir string) {
	status := PluginStatus{Path: dir}

	defer func() {
		if rec := recover(); rec != nil {
			status.Loaded = false
			status.Err = fmt.Sprintf("panic: %v", rec)
			log.Printf("plugin runtime: %s panicked during load: %v", dir, rec)
		}
		r.mu.Lock()
		r.plugins = append(r.plugins, status)
		r.mu.Unlock()
	}()

	src, err := os.ReadFile(filepath.Join(dir, "plugin.go"))
	if err != nil {
		status.Err = fmt.Sprintf("no plugin.go: %v", err)
		return
	}

	script, err := compileScript(string(src))
	if err != nil {
		status.Err = err.Error()
		return
	}

	nameFn, err := script.funcValue("main.Name")
	if err != nil {
		status.Err = fmt.Sprintf("Name: %v", err)
		return
	}
	name, ok := nameFn.Interface().(func() string)
	if !ok {
		status.Err = "Name must have signature func() string"
		return
	}
	status.Name = name()

	initFn, err := script.funcValue("main.Init")
	if err != nil {
		status.Err = fmt.Sprintf("Init: %v", err)
		return
	}
	init, ok := initFn.Interface().(func(*Context) error)
	if !ok {
		status.Err = "Init must have signature func(*plugin.Context) error"
		return
	}

	ctx := r.newContext()
	if err := init(ctx); err != nil {
		status.Err = fmt.Sprintf("Init: %v", err)
		return
	}

	// Optional knowledge source: Source() + Import(ctx).
	source := status.Name
	if sv, err := script.funcValue("main.Source"); err == nil {
		if sf, ok := sv.Interface().(func() string); ok {
			source = sf()
		}
	}
	if iv, err := script.funcValue("main.Import"); err == nil {
		imp, ok := iv.Interface().(func(*Context) ([]plugin.ImportDoc, error))
		if !ok {
			status.Err = "Import must have signature func(*plugin.Context) ([]plugin.ImportDoc, error)"
			return
		}
		importFn := func() ([]plugin.ImportDoc, error) { return imp(ctx) }
		r.mu.Lock()
		r.sources[source] = &sourceEntry{name: source, plugin: status.Name, importFn: importFn}
		r.mu.Unlock()
		log.Printf("plugin runtime: plugin %s registered knowledge source %q", status.Name, source)
	}

	status.Loaded = true
	log.Printf("plugin runtime: loaded plugin %q from %s", status.Name, dir)
}

// PluginStatuses returns the current load status of every plugin directory.
func (r *Runtime) PluginStatuses() []PluginStatus {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]PluginStatus, len(r.plugins))
	copy(out, r.plugins)
	return out
}

// SourceStatuses returns the registered knowledge sources with their state.
func (r *Runtime) SourceStatuses() []SourceStatus {
	r.mu.Lock()
	defer r.mu.Unlock()
	out := make([]SourceStatus, 0, len(r.sources))
	for _, s := range r.sources {
		out = append(out, SourceStatus{
			Name:    s.name,
			Plugin:  s.plugin,
			Enabled: s.lastErr == nil,
		})
	}
	return out
}

// Emit delivers an event to every registered handler. A panicking handler is
// recovered and logged; the host never crashes.
func (r *Runtime) Emit(name string, data any) {
	r.mu.Lock()
	handlers := append([]plugin.EventHandler(nil), r.handlers[name]...)
	r.mu.Unlock()

	ev := plugin.Event{Name: name, Data: data}
	for _, h := range handlers {
		r.safeCall(func() error { return h(ev) }, fmt.Sprintf("event %q", name))
	}
}

// ImportRun summarizes a single knowledge import execution.
type ImportRun struct {
	Created int `json:"created"`
	Updated int `json:"updated"`
	Skipped int `json:"skipped"`
}

// Total returns the number of documents processed.
func (r ImportRun) Total() int { return r.Created + r.Updated + r.Skipped }

// SourceRun pairs a knowledge source with its latest import run, returned by
// ImportAll for reporting on startup auto-imports.
type SourceRun struct {
	Name string `json:"name"`
	Run  ImportRun `json:"run"`
	Err  string `json:"error,omitempty"`
}

// ImportAll triggers every registered knowledge source and returns per-source
// results. Sources that fail are reported with Err set rather than aborting the
// remaining sources.
func (r *Runtime) ImportAll() []SourceRun {
	r.mu.Lock()
	names := make([]string, 0, len(r.sources))
	for name := range r.sources {
		names = append(names, name)
	}
	r.mu.Unlock()

	results := make([]SourceRun, 0, len(names))
	for _, name := range names {
		run, err := r.TriggerImport(name)
		sr := SourceRun{Name: name, Run: run}
		if err != nil {
			sr.Err = err.Error()
		}
		results = append(results, sr)
	}
	return results
}

// TriggerImport runs the knowledge source registered under name and upserts
// the returned documents into the knowledge base.
func (r *Runtime) TriggerImport(name string) (ImportRun, error) {
	r.mu.Lock()
	src := r.sources[name]
	r.mu.Unlock()
	if src == nil {
		return ImportRun{}, fmt.Errorf("plugin runtime: unknown knowledge source %q", name)
	}

	docs, err := r.safeImport(src)
	if err != nil {
		return ImportRun{}, err
	}

	var run ImportRun
	for _, d := range docs {
		if d.ProjectID <= 0 {
			run.Skipped++
			continue
		}
		created, err := r.upsertDoc(d, src.name)
		if err != nil {
			log.Printf("plugin runtime: import %q doc %q failed: %v", name, d.Title, err)
			continue
		}
		if created {
			run.Created++
		} else {
			run.Updated++
		}
	}

	r.mu.Lock()
	src.imported = run.Total()
	src.lastErr = err
	r.mu.Unlock()
	log.Printf("plugin runtime: import %q -> created %d, updated %d, skipped %d", name, run.Created, run.Updated, run.Skipped)
	return run, nil
}

// upsertDoc creates or updates a note keyed by (project, source, title).
// Returns true when the note was created, false when updated.
func (r *Runtime) upsertDoc(doc plugin.ImportDoc, source string) (bool, error) {
	kind := doc.Kind
	if kind == "" {
		kind = "knowledge"
	}
	existing, err := db.GetNoteBySourceTitle(r.db, doc.ProjectID, source, doc.Title)
	if err == nil {
		if doc.Content != "" {
			_ = db.UpdateNote(r.db, existing.ID, doc.Content)
		}
		_ = db.UpdateNoteMeta(r.db, existing.ID, doc.Title, doc.Tags, kind, existing.Pinned)
		return false, nil
	}
	if err != sql.ErrNoRows {
		return false, err
	}
	_, err = db.CreateNoteEx(r.db, doc.ProjectID, doc.Title, doc.Content, doc.Tags, kind, source)
	if err != nil {
		return false, err
	}
	return true, nil
}

// safeCall runs fn, recovering any panic.
func (r *Runtime) safeCall(fn func() error, what string) {
	defer func() {
		if rec := recover(); rec != nil {
			log.Printf("plugin runtime: panic in %s: %v", what, rec)
		}
	}()
	if err := fn(); err != nil {
		log.Printf("plugin runtime: handler %s returned error: %v", what, err)
	}
}

// safeImport runs an importer, recovering any panic.
func (r *Runtime) safeImport(src *sourceEntry) (docs []plugin.ImportDoc, err error) {
	defer func() {
		if rec := recover(); rec != nil {
			docs = nil
			err = fmt.Errorf("plugin runtime: import %q panicked: %v", src.name, rec)
		}
	}()
	return src.importFn()
}

// Context implements plugin.PluginContext for scripts. Scripts receive it as
// *plugin.Context and call On to subscribe to events.
type Context struct {
	db *sql.DB
	rt *Runtime
}

func (r *Runtime) newContext() *Context {
	return &Context{db: r.db, rt: r}
}

// DB exposes the underlying SQLite handle.
func (c *Context) DB() *sql.DB { return c.db }

// On registers a handler for a runtime event.
func (c *Context) On(name string, handler plugin.EventHandler) {
	c.rt.mu.Lock()
	c.rt.handlers[name] = append(c.rt.handlers[name], handler)
	c.rt.mu.Unlock()
}

// RegisterKnowledgeSource registers a Go-native importer (kept for interface
// compatibility; script plugins export Import instead).
func (c *Context) RegisterKnowledgeSource(name string, importer plugin.KnowledgeImporter) {
	c.rt.RegisterSource(name, importer)
}

// RegisterSource registers a Go-native knowledge importer, allowing built-in
// importers (e.g. the Claude memory importer) to participate in the runtime
// without being loaded as scripts.
func (r *Runtime) RegisterSource(name string, importer plugin.KnowledgeImporter) {
	if importer == nil {
		return
	}
	r.mu.Lock()
	r.sources[name] = &sourceEntry{name: name, plugin: "builtin", importFn: importer.Import}
	r.mu.Unlock()
}
