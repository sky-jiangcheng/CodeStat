package scanner

import (
	"os"
	"path/filepath"
	"testing"
)

// makeRepo creates a directory containing a .git subdirectory.
func makeRepo(t *testing.T, path string) {
	t.Helper()
	if err := os.MkdirAll(filepath.Join(path, ".git"), 0750); err != nil {
		t.Fatal(err)
	}
}

func TestScanRepositoriesFindsNestedRepos(t *testing.T) {
	root := t.TempDir()
	makeRepo(t, filepath.Join(root, "alpha"))
	makeRepo(t, filepath.Join(root, "org", "beta"))
	makeRepo(t, filepath.Join(root, "org", "team", "gamma"))

	repos, err := ScanRepositories([]string{root}, 3)
	if err != nil {
		t.Fatalf("ScanRepositories: %v", err)
	}
	if len(repos) != 3 {
		t.Fatalf("expected 3 repos, got %d: %+v", len(repos), repos)
	}
}

func TestScanRepositoriesDepthLimit(t *testing.T) {
	root := t.TempDir()
	makeRepo(t, filepath.Join(root, "level1", "level2", "deep"))

	repos, err := ScanRepositories([]string{root}, 1)
	if err != nil {
		t.Fatalf("ScanRepositories: %v", err)
	}
	if len(repos) != 0 {
		t.Errorf("depth 1 should not find a repo nested 3 levels deep, got %+v", repos)
	}

	repos, err = ScanRepositories([]string{root}, 3)
	if err != nil {
		t.Fatalf("ScanRepositories: %v", err)
	}
	if len(repos) != 1 {
		t.Errorf("depth 3 should find the nested repo, got %+v", repos)
	}
}

func TestScanRepositoriesRootIsRepo(t *testing.T) {
	root := t.TempDir()
	makeRepo(t, root)

	repos, err := ScanRepositories([]string{root}, 1)
	if err != nil {
		t.Fatalf("ScanRepositories: %v", err)
	}
	if len(repos) != 1 || repos[0].Depth != 0 {
		t.Errorf("root repo should be found at depth 0, got %+v", repos)
	}
}

func TestScanRepositoriesSkipsMissingRoot(t *testing.T) {
	repos, err := ScanRepositories([]string{filepath.Join(t.TempDir(), "does-not-exist")}, 2)
	if err != nil {
		t.Fatalf("missing root should be skipped without error, got %v", err)
	}
	if len(repos) != 0 {
		t.Errorf("expected no repos, got %+v", repos)
	}
}

func TestScanRepositoriesDoesNotDescendIntoRepos(t *testing.T) {
	root := t.TempDir()
	// A repo containing a nested repo must not report the nested one.
	makeRepo(t, filepath.Join(root, "outer"))
	makeRepo(t, filepath.Join(root, "outer", "inner"))

	repos, err := ScanRepositories([]string{root}, 3)
	if err != nil {
		t.Fatalf("ScanRepositories: %v", err)
	}
	if len(repos) != 1 {
		t.Errorf("scanner must not descend into repositories, got %+v", repos)
	}
}
