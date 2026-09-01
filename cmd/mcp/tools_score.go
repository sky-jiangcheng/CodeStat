package main

import (
	"github.com/mark3labs/mcp-go/server"
	"context"

	"github.com/mark3labs/mcp-go/mcp"

	"gitbuddy/internal/service"
)

func registerScoreTool(s *server.MCPServer, svc *service.Service) {
	s.AddTool(mcp.Tool{
		Name:        "gitbuddy_agent_score",
		Description: "Check AI-readiness of the local GitBuddy installation (database, notes, search, MCP, llms.txt, SKILL.md, i18n). Run this first to verify the environment is properly set up.",
		InputSchema: mcp.ToolInputSchema{
			Type:       "object",
			Properties: map[string]any{},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return makeTextResult(runAgentScore(svc)), nil
	})
}
