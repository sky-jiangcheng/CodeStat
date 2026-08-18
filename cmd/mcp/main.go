// gitboard-mcp is the GitBuddy MCP server: it exposes the local Git knowledge
// base (notes, projects, search) to AI agents over the Model Context
// Protocol on stdio. The database is opened once at startup and every tool
// call shares the same service instance as the desktop app.
package main

import (
	"context"
	"encoding/json"
	"fmt"
	"log"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"gitboard/internal/db"
	"gitboard/internal/platform"
	"gitboard/internal/service"
	"gitboard/internal/version"
)

func main() {
	d, err := db.InitDB(platform.GetDbPath())
	if err != nil {
		log.Fatalf("database error: %v", err)
	}
	defer d.Close()
	svc := service.New(d, platform.GetGitUserName())

	mcpServer := server.NewMCPServer("gitboard-mcp", version.Version)

	mcpServer.AddTool(mcp.Tool{
		Name:        "gitboard_notes_list",
		Description: "List all knowledge notes across projects",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]any{
				"limit": map[string]any{
					"type":        "number",
					"description": "Max notes to return (default: 50)",
				},
			},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		notes := svc.ListAllNotes()
		if v, ok := req.GetArguments()["limit"].(float64); ok && v > 0 && int(v) < len(notes) {
			notes = notes[:int(v)]
		}
		return makeJSONResult("notes_list", notes)
	})

	mcpServer.AddTool(mcp.Tool{
		Name:        "gitboard_notes_search",
		Description: "Search notes and todos by query using FTS5 full-text search",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]any{
				"query": map[string]any{
					"type":        "string",
					"description": "Search query",
				},
			},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		query, _ := req.GetArguments()["query"].(string)
		if query == "" {
			return makeTextResult("query is required"), nil
		}
		return makeJSONResult("notes_search", svc.SearchAll(query))
	})

	mcpServer.AddTool(mcp.Tool{
		Name:        "gitboard_notes_read",
		Description: "Read a single note by ID",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]any{
				"id": map[string]any{
					"type":        "number",
					"description": "Note ID",
				},
			},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		id, _ := req.GetArguments()["id"].(float64)
		note, err := svc.GetNote(int64(id))
		if err != nil {
			return makeTextResult(fmt.Sprintf("note not found: %v", err)), nil
		}
		return makeJSONResult("note_read", note)
	})

	mcpServer.AddTool(mcp.Tool{
		Name:        "gitboard_projects_list",
		Description: "List all projects",
		InputSchema: mcp.ToolInputSchema{
			Type:       "object",
			Properties: map[string]any{},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return makeJSONResult("projects_list", svc.ListProjects())
	})

	mcpServer.AddTool(mcp.Tool{
		Name:        "gitboard_projects_stats",
		Description: "Get statistics for a specific project (repos, stats)",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]any{
				"id": map[string]any{
					"type":        "number",
					"description": "Project ID",
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

	mcpServer.AddTool(mcp.Tool{
		Name:        "gitboard_ask",
		Description: "Ask a question against the local knowledge base (notes + todos search)",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]any{
				"query": map[string]any{
					"type":        "string",
					"description": "Question or search query",
				},
			},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		query, _ := req.GetArguments()["query"].(string)
		if query == "" {
			return makeTextResult("query is required"), nil
		}
		hits := svc.SearchAll(query)
		if len(hits) == 0 {
			return makeTextResult("No results found for: " + query), nil
		}
		return makeTextResult(strings.Join(service.FormatSearchAnswer(hits, 5), "\n---\n")), nil
	})

	log.Printf("GitBuddy MCP server v%s starting on stdio...", version.Version)
	if err := server.ServeStdio(mcpServer); err != nil {
		log.Fatalf("MCP server error: %v", err)
	}
}

func makeTextResult(text string) *mcp.CallToolResult {
	return mcp.NewToolResultText(text)
}

func makeJSONResult(name string, data any) (*mcp.CallToolResult, error) {
	bytes, err := json.MarshalIndent(data, "", "  ")
	if err != nil {
		return makeTextResult(fmt.Sprintf("marshal error: %v", err)), nil
	}
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			mcp.TextContent{Type: "text", Text: string(bytes)},
		},
	}, nil
}
