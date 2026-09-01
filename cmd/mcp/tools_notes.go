package main

import (
	"github.com/mark3labs/mcp-go/server"
	"context"
	"fmt"

	"github.com/mark3labs/mcp-go/mcp"

	"gitboard/internal/domain"
	"gitboard/internal/service"
)

func registerNoteTools(s *server.MCPServer, svc *service.Service) {
	s.AddTool(mcp.Tool{
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

	s.AddTool(mcp.Tool{
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
		hits := svc.SearchAll(query)
		type searchResult struct {
			Total int               `json:"total"`
			Hits  []domain.SearchHit `json:"hits"`
		}
		return makeJSONResult("notes_search", searchResult{Total: len(hits), Hits: hits})
	})

	s.AddTool(mcp.Tool{
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

	s.AddTool(mcp.Tool{
		Name:        "gitboard_notes_create",
		Description: "Create a new knowledge note. Recommended workflow: read project first, then create with appropriate tags.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]any{
				"project_id": map[string]any{
					"type":        "number",
					"description": "Project ID to attach the note to",
				},
				"title": map[string]any{
					"type":        "string",
					"description": "Note title (1-80 chars, recommended)",
				},
				"content": map[string]any{
					"type":        "string",
					"description": "Markdown content of the note (required)",
				},
				"category": map[string]any{
					"type":        "string",
					"description": "Category: knowledge, log, idea, or other (default: knowledge)",
				},
				"tags": map[string]any{
					"type":        "string",
					"description": "Comma-separated tags for categorization",
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

	s.AddTool(mcp.Tool{
		Name:        "gitboard_notes_update",
		Description: "Update an existing note's content and/or metadata. Pass only the fields you want to change.",
		InputSchema: mcp.ToolInputSchema{
			Type: "object",
			Properties: map[string]any{
				"id": map[string]any{
					"type":        "number",
					"description": "Note ID to update (required)",
				},
				"content": map[string]any{
					"type":        "string",
					"description": "New Markdown content (optional, omit to keep existing)",
				},
				"title": map[string]any{
					"type":        "string",
					"description": "New title (optional)",
				},
				"tags": map[string]any{
					"type":        "string",
					"description": "New comma-separated tags (optional)",
				},
				"category": map[string]any{
					"type":        "string",
					"description": "New category: knowledge, log, idea, or other (optional)",
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
}
