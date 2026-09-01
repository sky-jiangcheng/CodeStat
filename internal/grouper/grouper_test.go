package grouper

import (
	"path/filepath"
	"testing"

	"gitbuddy/internal/scanner"
)

func TestGroupRepositories_Empty(t *testing.T) {
	groups := GroupRepositories(nil)
	if len(groups) != 0 {
		t.Errorf("expected 0 groups for nil input, got %d", len(groups))
	}

	groups = GroupRepositories([]scanner.RepoInfo{})
	if len(groups) != 0 {
		t.Errorf("expected 0 groups for empty input, got %d", len(groups))
	}
}

func TestGroupRepositories_SingleRepo(t *testing.T) {
	repos := []scanner.RepoInfo{
		{Path: "/home/user/projects/myapp", Depth: 1},
	}
	groups := GroupRepositories(repos)
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	if groups[0].Name != "projects" {
		t.Errorf("expected group name 'projects', got '%s'", groups[0].Name)
	}
	if len(groups[0].Repos) != 1 {
		t.Errorf("expected 1 repo in group, got %d", len(groups[0].Repos))
	}
}

func TestGroupRepositories_MultipleReposSameParent(t *testing.T) {
	repos := []scanner.RepoInfo{
		{Path: filepath.Join("/tmp", "workspace", "frontend"), Depth: 2},
		{Path: filepath.Join("/tmp", "workspace", "backend"), Depth: 2},
	}
	groups := GroupRepositories(repos)
	if len(groups) != 1 {
		t.Fatalf("expected 1 group, got %d", len(groups))
	}
	if len(groups[0].Repos) != 2 {
		t.Errorf("expected 2 repos in group, got %d", len(groups[0].Repos))
	}
}

func TestGroupRepositories_NestedRepos(t *testing.T) {
	repos := []scanner.RepoInfo{
		{Path: filepath.Join("/tmp", "monorepo"), Depth: 0},
		{Path: filepath.Join("/tmp", "monorepo", "sub1"), Depth: 1},
		{Path: filepath.Join("/tmp", "monorepo", "sub2"), Depth: 1},
	}
	groups := GroupRepositories(repos)
	if len(groups) < 2 {
		t.Fatalf("expected at least 2 groups for nested repos, got %d", len(groups))
	}
}

func TestGroupRepositories_DifferentParents(t *testing.T) {
	repos := []scanner.RepoInfo{
		{Path: filepath.Join("/tmp", "proj-a", "repo1"), Depth: 2},
		{Path: filepath.Join("/tmp", "proj-b", "repo2"), Depth: 2},
	}
	groups := GroupRepositories(repos)
	if len(groups) != 2 {
		t.Fatalf("expected 2 groups for different parents, got %d", len(groups))
	}
}

func TestIsDirectChild(t *testing.T) {
	tests := []struct {
		parent, child string
		expected      bool
	}{
		{"/home", "/home/user", true},
		{"/home", "/home/user/projects", false},
		{"/", "/home", true},
		{"/home", "/etc", false},
	}
	for _, tc := range tests {
		result := isDirectChild(tc.parent, tc.child)
		if result != tc.expected {
			t.Errorf("isDirectChild(%s, %s) = %v, want %v", tc.parent, tc.child, result, tc.expected)
		}
	}
}
