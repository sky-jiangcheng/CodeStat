package service

import (
	"encoding/json"
	"strings"
	"testing"
)

// TestGetProjectOverview_EmptyArraysNotNil guards against a regression where
// GetProjectOverview returned nil (not empty) slices for recent_commits,
// dependencies and top_contributors. A nil slice marshals to JSON `null`, and
// the project detail page read `overview.recent_commits.length` directly,
// throwing "e.recent_commits is null" and crashing the whole page.
func TestGetProjectOverview_EmptyArraysNotNil(t *testing.T) {
	svc, _ := setupService(t)
	pid := seedProject(t, svc.db, "proj", "/tmp/proj")

	ov, err := svc.GetProjectOverview(pid)
	if err != nil {
		t.Fatalf("GetProjectOverview: %v", err)
	}

	if ov.TechStack == nil {
		t.Errorf("TechStack should be non-nil empty slice, got nil")
	}
	if ov.Languages == nil {
		t.Errorf("Languages should be non-nil empty slice, got nil")
	}
	if ov.Dependencies == nil {
		t.Errorf("Dependencies should be non-nil empty slice, got nil")
	}
	if ov.TopContributors == nil {
		t.Errorf("TopContributors should be non-nil empty slice, got nil")
	}
	if ov.RecentCommits == nil {
		t.Errorf("RecentCommits should be non-nil empty slice, got nil")
	}

	// And they must JSON-encode as [] rather than null.
	b, err := json.Marshal(ov)
	if err != nil {
		t.Fatalf("marshal overview: %v", err)
	}
	s := string(b)
	for _, f := range []string{"tech_stack", "languages", "dependencies", "top_contributors", "recent_commits"} {
		if strings.Contains(s, `"`+f+`":null`) {
			t.Errorf("overview JSON contains null array field %q: %s", f, s)
		}
	}
}
