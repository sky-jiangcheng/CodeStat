package httpapi

import (
	"encoding/json"
	"net/http"
	"net/http/httptest"
	"strings"
	"testing"

	"gitbuddy/internal/db"
	"gitbuddy/internal/service"
)

// Regression: the headless server is a third JSON boundary (besides Wails and
// MCP) over internal/service. Empty collections must serialise as []/{} here
// too, never null, or dsh-plugin tools that forward the payload to a model
// (and any JSON consumer) get a null where an array is expected.
func TestSearchHitsNotEmptyNull(t *testing.T) {
	database, err := db.InitDB(":memory:")
	if err != nil {
		t.Fatalf("init db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	svc := service.New(database, "me")
	h := New(svc)

	rec := httptest.NewRecorder()
	h.ServeHTTP(rec, httptest.NewRequest(http.MethodGet, "/api/search?q=anything", nil))
	if rec.Code != http.StatusOK {
		t.Fatalf("status = %d, want 200", rec.Code)
	}

	var body struct {
		Query string          `json:"query"`
		Hits  json.RawMessage `json:"hits"`
	}
	if err := json.Unmarshal(rec.Body.Bytes(), &body); err != nil {
		t.Fatalf("unmarshal: %v", err)
	}
	if body.Hits == nil || string(body.Hits) == "null" {
		t.Errorf("hits serialised as null, want []: %s", body.Hits)
	}
}

func TestEndpoints(t *testing.T) {
	database, err := db.InitDB(":memory:")
	if err != nil {
		t.Fatalf("init db: %v", err)
	}
	t.Cleanup(func() { _ = database.Close() })

	h := New(service.New(database, "me"))

	tests := []struct {
		name       string
		method     string
		path       string
		wantStatus int
		wantBody   string
	}{
		{"health", http.MethodGet, "/health", http.StatusOK, `"status":"ok"`},
		{"search missing q", http.MethodGet, "/api/search", http.StatusBadRequest, "missing query"},
		{"project not found", http.MethodGet, "/api/project/999999/overview", http.StatusNotFound, "error"},
		{"project bad id", http.MethodGet, "/api/project/abc/overview", http.StatusBadRequest, "invalid project id"},
		{"ai_context has markdown", http.MethodPost, "/api/ai_context", http.StatusOK, `"markdown"`},
	}

	for _, tc := range tests {
		t.Run(tc.name, func(t *testing.T) {
			rec := httptest.NewRecorder()
			h.ServeHTTP(rec, httptest.NewRequest(tc.method, tc.path, nil))
			if rec.Code != tc.wantStatus {
				t.Fatalf("status = %d, want %d (body %s)", rec.Code, tc.wantStatus, rec.Body.String())
			}
			if !strings.Contains(rec.Body.String(), tc.wantBody) {
				t.Errorf("body %q missing %q", rec.Body.String(), tc.wantBody)
			}
		})
	}
}
