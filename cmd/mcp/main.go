// gitbuddy-mcp is the GitBuddy MCP server: it exposes the local Git knowledge
// base (notes, projects, search) to AI agents over the Model Context
// Protocol on stdio. The database is opened once at startup and every tool
// call shares the same service instance as the desktop app.
package main

import (
	"context"
	"fmt"
	"log"
	"strings"

	"github.com/mark3labs/mcp-go/mcp"
	"github.com/mark3labs/mcp-go/server"

	"gitbuddy/internal/db"
	"gitbuddy/internal/platform"
	"gitbuddy/internal/service"
	"gitbuddy/internal/version"
)

func main() {
	d, err := db.InitDB(platform.GetDbPath())
	if err != nil {
		log.Fatalf("database error: %v", err)
	}
	defer d.Close()
	svc := service.New(d, platform.GetGitUserName())

	mcpServer := server.NewMCPServer("gitbuddy-mcp", version.Version)

	mcpServer.AddTool(mcp.Tool{
		Name:        "gitbuddy_notes_list",
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
		Name:        "gitbuddy_notes_search",
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
		Name:        "gitbuddy_notes_read",
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
		Name:        "gitbuddy_projects_list",
		Description: "List all projects",
		InputSchema: mcp.ToolInputSchema{
			Type:       "object",
			Properties: map[string]any{},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return makeJSONResult("projects_list", svc.ListProjects())
	})

	mcpServer.AddTool(mcp.Tool{
		Name:        "gitbuddy_projects_stats",
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
		Name:        "gitbuddy_ask",
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

	mcpServer.AddTool(mcp.Tool{
		Name:        "gitbuddy_notes_create",
		Description: "Create a new knowledge note",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]any{
				"project_id": map[string]any{
					"type":        "number",
					"description": "Project ID to attach the note to",
				},
				"title": map[string]any{
					"type":        "string",
					"description": "Note title",
				},
				"content": map[string]any{
					"type":        "string",
					"description": "Markdown content of the note",
				},
				"category": map[string]any{
					"type":        "string",
					"description": "Category: knowledge, log, idea, or other (default: knowledge)",
				},
				"tags": map[string]any{
					"type":        "string",
					"description": "Comma-separated tags",
				},
			},
			Required: []string{"project_id", "title", "content"},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		projectID, _ := args["project_id"].(float64)
		title, _ := args["title"].(string)
		content, _ := args["content"].(string)
		category, _ := args["category"].(string)
		if category == "" {
			category = "knowledge"
		}
		tags, _ := args["tags"].(string)

		note, err := svc.CreateNoteWithMeta(int64(projectID), title, content, tags, category, "mcp")
		if err != nil {
			return makeTextResult(fmt.Sprintf("error: %v", err)), nil
		}
		return makeJSONResult("note_created", note)
	})

	mcpServer.AddTool(mcp.Tool{
		Name:        "gitbuddy_notes_update",
		Description: "Update an existing note's content and/or metadata",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]any{
				"id": map[string]any{
					"type":        "number",
					"description": "Note ID to update",
				},
				"content": map[string]any{
					"type":        "string",
					"description": "New Markdown content",
				},
				"title": map[string]any{
					"type":        "string",
					"description": "New title",
				},
				"tags": map[string]any{
					"type":        "string",
					"description": "New comma-separated tags",
				},
				"category": map[string]any{
					"type":        "string",
					"description": "New category: knowledge, log, idea, or other",
				},
			},
			Required: []string{"id"},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		args := req.GetArguments()
		id, _ := args["id"].(float64)
		content, _ := args["content"].(string)
		title, _ := args["title"].(string)
		tags, _ := args["tags"].(string)
		category, _ := args["category"].(string)

		if content != "" {
			if err := svc.UpdateNote(int64(id), content); err != nil {
				return makeTextResult(fmt.Sprintf("error: %v", err)), nil
			}
		}
		if title != "" || tags != "" || category != "" {
			if err := svc.UpdateNoteMeta(int64(id), title, tags, category, false); err != nil {
				return makeTextResult(fmt.Sprintf("error updating metadata: %v", err)), nil
			}
		}
		note, err := svc.GetNote(int64(id))
		if err != nil {
			return makeTextResult(fmt.Sprintf("error fetching note: %v", err)), nil
		}
		return makeJSONResult("note_updated", note)
	})

	mcpServer.AddTool(mcp.Tool{
		Name:        "gitbuddy_agent_score",
		Description: "Check AI-readiness of the local GitBuddy installation (database, notes, search, MCP, llms.txt, SKILL.md, i18n)",
		InputSchema: mcp.ToolInputSchema{
			Type:       "object",
			Properties: map[string]any{},
		},
	}, func(ctx context.Context, req mcp.CallToolRequest) (*mcp.CallToolResult, error) {
		return makeTextResult(runAgentScore(svc)), nil
	})

	log.Printf("GitBuddy MCP server v%s starting on stdio...", version.Version)
	if err := server.ServeStdio(mcpServer); err != nil {
		log.Fatalf("MCP server error: %v", err)
	}
}
