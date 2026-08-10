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
)

func main() {
	mcpServer := server.NewDefaultServer("gitboard-mcp", "1.5.7")

	mcpServer.HandleListTools(func(ctx context.Context, cursor *string) (*mcp.ListToolsResult, error) {
		_ = cursor
		tools := []mcp.Tool{
			{
				Name:        "gitboard_notes_list",
				Description: "List all knowledge notes across projects",
				InputSchema: mcp.ToolInputSchema{
					Type: "object",
					Properties: map[string]interface{}{
						"limit": map[string]interface{}{
							"type":        "number",
							"description": "Max notes to return (default: 50)",
						},
					},
				},
			},
			{
				Name:        "gitboard_notes_search",
				Description: "Search notes and todos by query using FTS5 full-text search",
				InputSchema: mcp.ToolInputSchema{
					Type: "object",
					Properties: map[string]interface{}{
						"query": map[string]interface{}{
							"type":        "string",
							"description": "Search query",
						},
					},
				},
			},
			{
				Name:        "gitboard_notes_read",
				Description: "Read a single note by ID",
				InputSchema: mcp.ToolInputSchema{
					Type: "object",
					Properties: map[string]interface{}{
						"id": map[string]interface{}{
							"type":        "number",
							"description": "Note ID",
						},
					},
				},
			},
			{
				Name:        "gitboard_projects_list",
				Description: "List all projects",
				InputSchema: mcp.ToolInputSchema{
					Type: "object",
					Properties: map[string]interface{}{},
				},
			},
			{
				Name:        "gitboard_projects_stats",
				Description: "Get statistics for a specific project (repos, stats)",
				InputSchema: mcp.ToolInputSchema{
					Type: "object",
					Properties: map[string]interface{}{
						"id": map[string]interface{}{
							"type":        "number",
							"description": "Project ID",
						},
					},
				},
			},
			{
				Name:        "gitboard_ask",
				Description: "Ask a question against the local knowledge base (notes + todos search)",
				InputSchema: mcp.ToolInputSchema{
					Type: "object",
					Properties: map[string]interface{}{
						"query": map[string]interface{}{
							"type":        "string",
							"description": "Question or search query",
						},
					},
				},
			},
		}
		return &mcp.ListToolsResult{Tools: tools}, nil
	})

	mcpServer.HandleCallTool(func(ctx context.Context, name string, arguments map[string]interface{}) (*mcp.CallToolResult, error) {
		d, err := db.InitDB(platform.GetDbPath())
		if err != nil {
			return makeTextResult(fmt.Sprintf("database error: %v", err)), nil
		}
		defer d.Close()

		switch name {
		case "gitboard_notes_list":
			notes, err := db.ListAllNotes(d)
			if err != nil {
				return makeTextResult(fmt.Sprintf("error: %v", err)), nil
			}
			return makeJSONResult("notes_list", notes)

		case "gitboard_notes_search":
			query, _ := arguments["query"].(string)
			if query == "" {
				return makeTextResult("query is required"), nil
			}
			hits, err := db.SearchAll(d, query)
			if err != nil {
				return makeTextResult(fmt.Sprintf("search error: %v", err)), nil
			}
			return makeJSONResult("notes_search", hits)

		case "gitboard_notes_read":
			idFloat, _ := arguments["id"].(float64)
			id := int64(idFloat)
			note, err := db.GetNoteByID(d, id)
			if err != nil {
				return makeTextResult(fmt.Sprintf("note not found: %v", err)), nil
			}
			return makeJSONResult("note_read", note)

		case "gitboard_projects_list":
			projects, err := db.GetAllProjects(d)
			if err != nil {
				return makeTextResult(fmt.Sprintf("error: %v", err)), nil
			}
			return makeJSONResult("projects_list", projects)

		case "gitboard_projects_stats":
			idFloat, _ := arguments["id"].(float64)
			id := int64(idFloat)
			project, err := db.GetProjectByID(d, id)
			if err != nil {
				return makeTextResult(fmt.Sprintf("project not found: %v", err)), nil
			}
			repos, err := db.GetAllRepositories(d)
			if err != nil {
				return makeTextResult(fmt.Sprintf("error: %v", err)), nil
			}
			var projRepos []db.Repository
			for _, r := range repos {
				if r.ProjectID != nil && *r.ProjectID == id {
					projRepos = append(projRepos, r)
				}
			}
			result := struct {
				Project   *db.Project     `json:"project"`
				Repos     []db.Repository `json:"repos"`
				RepoCount int             `json:"repo_count"`
			}{Project: project, Repos: projRepos, RepoCount: len(projRepos)}
			return makeJSONResult("project_stats", result)

		case "gitboard_ask":
			query, _ := arguments["query"].(string)
			if query == "" {
				return makeTextResult("query is required"), nil
			}
			hits, err := db.SearchAll(d, query)
			if err != nil {
				return makeTextResult(fmt.Sprintf("search error: %v", err)), nil
			}
			if len(hits) == 0 {
				return makeTextResult("No results found for: " + query), nil
			}
			var parts []string
			for i, h := range hits {
				if i >= 5 {
					break
				}
				parts = append(parts, fmt.Sprintf("[%s] %s\n%s", h.Type, h.Title, h.Snippet))
			}
			return makeTextResult(strings.Join(parts, "\n---\n")), nil

		default:
			return makeTextResult(fmt.Sprintf("unknown tool: %s", name)), nil
		}
	})

	log.Printf("GitBuddy MCP server starting on stdio...")
	if err := server.ServeStdio(mcpServer); err != nil {
		log.Fatalf("MCP server error: %v", err)
	}
}

func makeTextResult(text string) *mcp.CallToolResult {
	return &mcp.CallToolResult{
		Content: []mcp.Content{
			mcp.TextContent{Type: "text", Text: text},
		},
	}
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
