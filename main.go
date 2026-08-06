package main

import (
	"embed"
	"log"
	"os"
	"path/filepath"

	"gitbuddy/internal/db"
	"gitbuddy/internal/platform"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:web/dist
var assets embed.FS

func init() {
	// Ensure PATH includes common binary directories (git may not be in PATH when launched from Finder)
	ensurePath()
	// Redirect logs to file so crashes can be diagnosed when launched from Finder
	setupLogging()
}

func main() {
	log.Println("GitBuddy starting...")

	// Open database
	database, err := db.InitDB(platform.GetDbPath())
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	// Seed default scan roots on first run. Tracked by a config flag so a user
	// who explicitly removes all roots is not re-seeded on the next launch.
	if seeded, _ := db.GetConfig(database, "scan_roots_seeded"); seeded == "" {
		defaults := platform.DefaultScanRoots()
		if len(defaults) > 0 {
			if err := db.ReplaceScanRoots(database, defaults); err != nil {
				log.Printf("Failed to seed default scan roots: %v", err)
			} else {
				log.Printf("Seeded %d default scan roots", len(defaults))
			}
		}
		_ = db.SetConfig(database, "scan_roots_seeded", "1")
	}

	// Detect git user
	gitUser := platform.GetGitUserName()
	if gitUser != "" {
		log.Printf("Git user detected: %s", gitUser)
	} else {
		log.Println("No git user detected; personal stats will be empty")
	}

	// Create app with dependencies
	app := NewApp(database, gitUser)

	// Launch Wails
	err = wails.Run(&options.App{
		Title:     "GitBuddy",
		Width:     1280,
		Height:    800,
		MinWidth:  800,
		MinHeight: 600,
		AssetServer: &assetserver.Options{
			Assets: assets,
		},
		OnStartup:  app.startup,
		OnShutdown: app.shutdown,
		Bind: []interface{}{
			app,
		},
	})
	if err != nil {
		log.Fatalf("Error: %v", err)
	}
}

func ensurePath() {
	path := os.Getenv("PATH")
	if path == "" {
		path = "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
	} else {
		path = "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin:" + path
	}
	os.Setenv("PATH", path)
}

func setupLogging() {
	logDir, err := os.UserHomeDir()
	if err != nil {
		logDir = os.TempDir()
	}
	logDir = filepath.Join(logDir, "Library", "Logs")
	_ = os.MkdirAll(logDir, 0750)
	logFile := filepath.Join(logDir, "gitbuddy.log")
	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0640)
	if err == nil {
		log.SetOutput(f)
	}
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("=== GitBuddy log started ===")
	log.Printf("PATH=%s", os.Getenv("PATH"))
}
