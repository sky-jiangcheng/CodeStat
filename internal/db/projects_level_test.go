package db

import (
	"database/sql"
	"testing"
)

// mustExecProject inserts a project and returns its id.
func mustExecProject(t *testing.T, database *sql.DB, name, rootPath string) int64 {
	t.Helper()
	res, err := database.Exec("INSERT INTO projects (name, root_path) VALUES (?, ?)", name, rootPath)
	if err != nil {
		t.Fatalf("insert project %s: %v", name, err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("project id: %v", err)
	}
	return id
}

// mustExecRepo inserts a repository bound to a project and returns its id.
func mustExecRepo(t *testing.T, database *sql.DB, path string, projectID int64) int64 {
	t.Helper()
	res, err := database.Exec("INSERT INTO repositories (path, project_id) VALUES (?, ?)", path, projectID)
	if err != nil {
		t.Fatalf("insert repo %s: %v", path, err)
	}
	id, err := res.LastInsertId()
	if err != nil {
		t.Fatalf("repo id: %v", err)
	}
	return id
}

func TestSplitProjectDownMultiRepo(t *testing.T) {
	database := setupTestDB(t)

	// Parent project with two repos under /tmp/workspace.
	pid := mustExecProject(t, database, "workspace", "/tmp/workspace")
	repo1 := mustExecRepo(t, database, "/tmp/workspace/repo-a", pid)
	repo2 := mustExecRepo(t, database, "/tmp/workspace/repo-b", pid)

	newLevel, err := SplitProjectDown(database, pid)
	if err != nil {
		t.Fatalf("SplitProjectDown failed: %v", err)
	}
	if newLevel != -1 {
		t.Errorf("expected new level -1, got %d", newLevel)
	}

	projects, _ := GetAllProjects(database)
	if len(projects) != 2 {
		t.Fatalf("expected 2 projects after split, got %d", len(projects))
	}

	// The original keeps the first repo; the second repo moved to a new project.
	r1, _ := GetRepositoriesByProjectID(database, pid)
	if len(r1) != 1 || r1[0].ID != repo1 {
		t.Errorf("original project should keep only repo-a, got %d repos", len(r1))
	}
	var otherID int64
	for _, p := range projects {
		if p.ID != pid {
			otherID = p.ID
		}
	}
	r2, _ := GetRepositoriesByProjectID(database, otherID)
	if len(r2) != 1 || r2[0].ID != repo2 {
		t.Errorf("new project should hold repo-b, got %d repos", len(r2))
	}

	// The split project is no longer auto-grouped.
	p, _ := GetProjectByID(database, pid)
	if p.IsAutoGrouped {
		t.Error("project should not be auto-grouped after manual split")
	}
}

func TestSplitProjectDownSingleRepo(t *testing.T) {
	database := setupTestDB(t)
	pid := mustExecProject(t, database, "solo", "/tmp/solo")
	mustExecRepo(t, database, "/tmp/solo/repo", pid)

	if _, err := SplitProjectDown(database, pid); err != nil {
		t.Fatalf("SplitProjectDown on single-repo project failed: %v", err)
	}
	projects, _ := GetAllProjects(database)
	if len(projects) != 1 {
		t.Errorf("single-repo split must not create projects, got %d", len(projects))
	}
}

func TestMergeProjectUp(t *testing.T) {
	database := setupTestDB(t)

	// A at /tmp/workspace; B is a true sibling (direct child of /tmp); C is
	// nested deeper and must NOT be merged.
	pidA := mustExecProject(t, database, "workspace", "/tmp/workspace")
	pidB := mustExecProject(t, database, "sibling-b", "/tmp/sibling-b")
	pidC := mustExecProject(t, database, "elsewhere", "/tmp/other/repo-c")
	mustExecRepo(t, database, "/tmp/workspace/repo-a", pidA)
	mustExecRepo(t, database, "/tmp/sibling-b/repo", pidB)
	mustExecRepo(t, database, "/tmp/other/repo-c", pidC)

	newLevel, err := MergeProjectUp(database, pidA)
	if err != nil {
		t.Fatalf("MergeProjectUp failed: %v", err)
	}
	if newLevel != 1 {
		t.Errorf("expected new level 1, got %d", newLevel)
	}

	projects, _ := GetAllProjects(database)
	if len(projects) != 2 {
		t.Fatalf("expected 2 projects after merge (workspace + elsewhere), got %d", len(projects))
	}

	// The merged project holds both workspace repos; notes/todos follow too.
	repos, _ := GetRepositoriesByProjectID(database, pidA)
	if len(repos) != 2 {
		t.Errorf("merged project should hold 2 repos, got %d", len(repos))
	}
	// The unrelated project is untouched.
	reposC, _ := GetRepositoriesByProjectID(database, pidC)
	if len(reposC) != 1 {
		t.Errorf("unrelated project should be untouched, got %d repos", len(reposC))
	}
	p, _ := GetProjectByID(database, pidA)
	if p.RootPath != "/tmp" || p.Name != "tmp" {
		t.Errorf("merged project should take the parent dir identity (/tmp), got %s/%s", p.RootPath, p.Name)
	}
	if p.IsAutoGrouped {
		t.Error("merged project should not be auto-grouped")
	}
}

func TestGetHeatmapDataProjectFilter(t *testing.T) {
	database := setupTestDB(t)

	pidA := mustExecProject(t, database, "a", "/tmp/a")
	pidB := mustExecProject(t, database, "b", "/tmp/b")
	repoA := mustExecRepo(t, database, "/tmp/a/r1", pidA)
	repoB := mustExecRepo(t, database, "/tmp/b/r2", pidB)

	if err := UpsertDailyStat(database, repoA, "2026-08-01", "all", 1, 10, 2); err != nil {
		t.Fatal(err)
	}
	if err := UpsertDailyStat(database, repoB, "2026-08-01", "all", 1, 5, 1); err != nil {
		t.Fatal(err)
	}

	global, err := GetHeatmapData(database, "2026-01-01", "2026-12-31", "", 0)
	if err != nil {
		t.Fatal(err)
	}
	if len(global) != 1 || global[0].LinesAdded != 15 {
		t.Fatalf("global heatmap should aggregate both repos (15 added), got %+v", global)
	}

	filtered, err := GetHeatmapData(database, "2026-01-01", "2026-12-31", "", pidA)
	if err != nil {
		t.Fatal(err)
	}
	if len(filtered) != 1 || filtered[0].LinesAdded != 10 {
		t.Fatalf("project heatmap should only count project A (10 added), got %+v", filtered)
	}
}
