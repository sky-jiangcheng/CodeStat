// Package version holds the single source of truth for the GitBuddy
// application version. All binaries (desktop app, CLI, MCP server,
// agent-score) and the OpenAPI spec read it from here; scripts/bump-version.sh
// keeps wails.json and web/package.json in sync with this constant.
package version

// Version is the current GitBuddy version.
const Version = "1.7.2"
