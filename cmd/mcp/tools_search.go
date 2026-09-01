package main

import (
	"github.com/mark3labs/mcp-go/server"
	"context"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"

	"gitbuddy/internal/service"
)

func registerSearchTool(s *server.MCPServer, svc *service.Service) {
	s.AddTool(mcp.Tool{
		Name:        "gitbuddy_ask",
		Description: "Ask a question against the local knowledge base (notes + todos search). Returns formatted answers with source references. Recommended workflow: search first (notes_search), then ask for synthesized answers.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]any{
				"query": map[string]any{
					"type":        "string",
					"description": "Question or search query (required)",
				},
				"limit": map[string]any{
					"type":        "number",
					"description": "Max results to return (default: 5)",
				},
			},
			Required: []string{"query"},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		query, _ := req.GetArguments()["query"].(string)
		if query == "" {
			return makeTextResult("query is required"), nil
		}
		hits := svc.SearchAll(query)
		if len(hits) == 0 {
			type askResult struct {
				Answer string `json:"answer"`
				Found  int    `json:"found"`
			}
			return makeJSONResult("ask", askResult{Answer: "No results found for: " + query, Found: 0})
		}
		type askHit struct {
			Type      string  `json:"type"`
			ID        int64   `json:"id"`
			ProjectID int64   `json:"project_id"`
			Title     string  `json:"title"`
			Snippet   string  `json:"snippet"`
			Score     float64 `json:"score"`
		}
		type askResult struct {
			Answer string    `json:"answer"`
			Found  int       `json:"found"`
			Hits   []askHit  `json:"hits"`
		}
		limit := 5
		if v, ok := req.GetArguments()["limit"].(float64); ok && v > 0 {
			limit = int(v)
		}
		displayHits := make([]askHit, 0, limit)
		for i, h := range hits {
			if i >= limit {
				break
			}
			displayHits = append(displayHits, askHit{
				Type: h.Type, ID: h.ID, ProjectID: h.ProjectID,
				Title: h.Title, Snippet: h.Snippet, Score: h.Rank,
			})
		}
		answer := strings.Join(service.FormatSearchAnswer(hits, limit), "\n---\n")
		return makeJSONResult("ask", askResult{Answer: answer, Found: len(hits), Hits: displayHits})
	})
}
