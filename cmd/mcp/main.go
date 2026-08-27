// gitboard-mcp is the GitBuddy MCP server: it exposes the local Git knowledge
// base (notes, projects, search) to AI agents over the Model Context
// Protocol on stdio. The database is opened once at startup and every tool
// call shares the same service instance as the desktop app.
package main

import (
	"log"

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

	registerNoteTools(mcpServer, svc)
	registerProjectTools(mcpServer, svc)
	registerSearchTool(mcpServer, svc)
	registerScoreTool(mcpServer, svc)

	log.Printf("GitBuddy MCP server v%s starting on stdio...", version.Version)
	if err := server.ServeStdio(mcpServer); err != nil {
		log.Fatalf("MCP server error: %v", err)
	}
}
