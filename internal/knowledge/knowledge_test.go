package knowledge

import (
	"os"
	"path/filepath"
	"strings"
	"testing"
)

// writeTemp creates a temp directory with the named files (path may contain
// subdirectories) and their contents, then returns the root.
func writeTemp(t *testing.T, files map[string]string) string {
	t.Helper()
	root := t.TempDir()
	for name, content := range files {
		path := filepath.Join(root, name)
		if err := os.MkdirAll(filepath.Dir(path), 0750); err != nil {
			t.Fatal(err)
		}
		if err := os.WriteFile(path, []byte(content), 0640); err != nil {
			t.Fatal(err)
		}
	}
	return root
}

func TestExtractREADME(t *testing.T) {
	root := writeTemp(t, map[string]string{
		"README.md": "# Title\n\nSome docs\n",
		"main.go":   "package main\n",
	})
	got, err := ExtractREADME(root)
	if err != nil {
		t.Fatalf("ExtractREADME: %v", err)
	}
	if !strings.Contains(got, "# Title") {
		t.Errorf("README excerpt should contain the heading, got %q", got)
	}
}

func TestExtractREADMENoReadme(t *testing.T) {
	// No README present: empty excerpt, no error (documented behaviour).
	got, err := ExtractREADME(t.TempDir())
	if err != nil {
		t.Fatalf("ExtractREADME without README should not error: %v", err)
	}
	if got != "" {
		t.Errorf("expected empty excerpt, got %q", got)
	}
}

func TestDetectTechStack(t *testing.T) {
	root := writeTemp(t, map[string]string{
		"package.json":         `{"name":"x","dependencies":{"react":"^19.0.0"}}`,
		"go.mod":               "module x\n\ngo 1.25\n",
		"Dockerfile":           "FROM alpine\n",
		"not-a-manifest.txt":   "ignore me",
	})
	techs, err := DetectTechStack(root)
	if err != nil {
		t.Fatalf("DetectTechStack: %v", err)
	}
	found := map[string]bool{}
	for _, tech := range techs {
		found[tech.Name] = true
	}
	for _, want := range []string{"JavaScript / TypeScript", "Go", "Docker"} {
		if !found[want] {
			t.Errorf("expected tech %q in detected stack, got %v", want, techs)
		}
	}
}

func TestDetectLanguages(t *testing.T) {
	root := writeTemp(t, map[string]string{
		"a.go": "package a\n",
		"b.go": "package b\n",
		"c.ts": "const x = 1\n",
	})
	langs, err := DetectLanguages(root)
	if err != nil {
		t.Fatalf("DetectLanguages: %v", err)
	}
	byLang := map[string]int{}
	for _, l := range langs {
		byLang[l.Language] = l.Count
	}
	if byLang["Go"] == 0 || byLang["TypeScript"] == 0 {
		t.Errorf("expected Go and TypeScript to be detected, got %v", byLang)
	}
	if byLang["Go"] != byLang["TypeScript"]*2 {
		t.Errorf("Go has twice the lines of TypeScript (2 vs 1 line files), got %v", byLang)
	}
}

func TestDetectDependenciesNpm(t *testing.T) {
	root := writeTemp(t, map[string]string{
		"package.json": `{
			"dependencies": {"react": "^19.0.0", "vite": "^8.0.0"},
			"devDependencies": {"typescript": "^7.0.0"}
		}`,
	})
	deps, err := DetectDependencies(root)
	if err != nil {
		t.Fatalf("DetectDependencies: %v", err)
	}
	names := map[string]string{}
	for _, d := range deps {
		names[d.Name] = d.Version
	}
	if names["react"] != "^19.0.0" {
		t.Errorf("expected react ^19.0.0, got %v", names)
	}
	if _, ok := names["typescript"]; !ok {
		t.Errorf("expected devDependencies to be included, got %v", names)
	}
}

func TestDetectDependenciesGo(t *testing.T) {
	root := writeTemp(t, map[string]string{
		"go.mod": "module gitbuddy\n\ngo 1.25.5\n\nrequire (\n\tgithub.com/spf13/cobra v1.8.0\n)\n",
	})
	deps, err := DetectDependencies(root)
	if err != nil {
		t.Fatalf("DetectDependencies: %v", err)
	}
	if len(deps) == 0 {
		t.Fatal("expected at least one go dependency")
	}
	found := false
	for _, d := range deps {
		if d.Name == "github.com/spf13/cobra" {
			found = true
		}
	}
	if !found {
		t.Errorf("expected cobra in deps, got %v", deps)
	}
}

func TestDetectDependenciesCargo(t *testing.T) {
	root := writeTemp(t, map[string]string{
		"Cargo.toml": "[dependencies]\nserde = \"1.0\"\n",
	})
	deps, err := DetectDependencies(root)
	if err != nil {
		t.Fatalf("DetectDependencies: %v", err)
	}
	if len(deps) != 1 || deps[0].Name != "serde" {
		t.Errorf("expected serde dep, got %v", deps)
	}
}

func TestDetectDependenciesNone(t *testing.T) {
	root := writeTemp(t, map[string]string{"main.go": "package main\n"})
	deps, err := DetectDependencies(root)
	if err != nil {
		t.Fatalf("DetectDependencies: %v", err)
	}
	if len(deps) != 0 {
		t.Errorf("expected no deps, got %v", deps)
	}
}

func TestDetectDependenciesGoBlock(t *testing.T) {
	// gofmt-standard block form must parse without panicking and find deps.
	root := writeTemp(t, map[string]string{
		"go.mod": `module gitbuddy

go 1.25.5

require (
	github.com/spf13/cobra v1.8.0
	github.com/mark3labs/mcp-go v0.32.0
)
`,
	})
	deps, err := DetectDependencies(root)
	if err != nil {
		t.Fatalf("DetectDependencies: %v", err)
	}
	names := map[string]bool{}
	for _, d := range deps {
		names[d.Name] = true
	}
	if !names["github.com/spf13/cobra"] || !names["github.com/mark3labs/mcp-go"] {
		t.Errorf("block-form requires should be parsed, got %v", deps)
	}
}

func TestDetectDependenciesGoRequireSingleAndBlock(t *testing.T) {
	root := writeTemp(t, map[string]string{
		"go.mod": `module x

go 1.25

require github.com/single/one v1.0.0

require (
	github.com/block/two v2.0.0
)
`,
	})
	deps, err := DetectDependencies(root)
	if err != nil {
		t.Fatalf("DetectDependencies: %v", err)
	}
	if len(deps) != 2 {
		t.Errorf("expected 2 deps (single + block), got %v", deps)
	}
}
