package main

import (
	"github.com/mark3labs/mcp-go/server"
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"

	"gitbuddy/internal/service"
)

func registerProjectTools(s *server.MCPServer, svc *service.Service) {
	s.AddTool(mcp.Tool{
		Name:        "gitbuddy_projects_list",
		Description: "List all tracked projects with their paths and IDs",
		InputSchema: mcp.ToolInputSchema{
			Type:       "object",
			Properties: map[string]any{},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return makeJSONResult("projects_list", svc.ListProjects())
	})

	s.AddTool(mcp.Tool{
		Name:        "gitbuddy_projects_stats",
		Description: "Get statistics for a specific project (repos, commit stats, activity)",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]any{
				"id": map[string]any{
					"type":        "number",
					"description": "Project ID (from projects_list)",
				},
			},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		id, _ := req.GetArguments()["id"].(float64)
		summary, err := svc.GetProjectSummary(int64(id))
		if err != nil {
			return makeTextResult(fmt.Sprintf("project not found: %v", err)), nil
		}
		return makeJSONResult("project_stats", summary)
	})
}
