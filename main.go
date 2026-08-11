package main

import (
	"embed"
	"log"
	"net/http"
	"os"
	"path/filepath"
	"runtime"
	"strings"

	"gitboard/internal/db"
	"gitboard/internal/platform"

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
			Assets:  assets,
			Handler: spaFallback{},
			Middleware: func(next http.Handler) http.Handler {
				return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
					// Security headers on every response
					w.Header().Set("Content-Security-Policy",
						"default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
					w.Header().Set("X-Content-Type-Options", "nosniff")
					w.Header().Set("X-Frame-Options", "DENY")
					w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
					w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), acceleration=()")
					next.ServeHTTP(w, r)
				})
			},
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

// spaFallback serves index.html for any GET request the embedded Assets could
// not resolve. With BrowserRouter the SPA owns real paths like /project/123, so
// a direct load or refresh of a deep link must receive the app shell.
type spaFallback struct{}

// ServeHTTP serves the SPA shell for any path not found in the embedded assets.
func (spaFallback) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	if r.Method != http.MethodGet {
		w.WriteHeader(http.StatusMethodNotAllowed)
		return
	}
	data, err := assets.ReadFile("web/dist/index.html")
	if err != nil {
		w.WriteHeader(http.StatusNotFound)
		return
	}
	w.Header().Set("Content-Type", "text/html; charset=utf-8")
	_, _ = w.Write(data)
}

func ensurePath() {
	path := os.Getenv("PATH")
	if path == "" {
		path = "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin"
		return
	}
	// Prepend standard directories if not already present.
	standardDirs := []string{"/usr/local/bin", "/usr/bin", "/bin", "/usr/sbin", "/sbin"}
	seen := make(map[string]bool)
	for _, dir := range strings.Split(path, string(os.PathListSeparator)) {
		seen[dir] = true
	}
	var toAdd []string
	for _, dir := range standardDirs {
		if !seen[dir] {
			toAdd = append(toAdd, dir)
		}
	}
	if len(toAdd) > 0 {
		os.Setenv("PATH", strings.Join(toAdd, string(os.PathListSeparator))+string(os.PathListSeparator)+path)
	}
}

func setupLogging() {
	logDir := getLogDir()
	_ = os.MkdirAll(logDir, 0750)
	logFile := filepath.Join(logDir, "gitboard.log")
	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0640)
	if err == nil {
		log.SetOutput(f)
	}
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("=== GitBuddy log started ===")
	log.Printf("PATH=%s", os.Getenv("PATH"))
}

// getLogDir returns a platform-appropriate log directory.
func getLogDir() string {
	switch runtime.GOOS {
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return os.TempDir()
		}
		return filepath.Join(home, "Library", "Logs")
	case "windows":
		if dir := os.Getenv("LOCALAPPDATA"); dir != "" {
			return filepath.Join(dir, "GitBuddy", "Logs")
		}
		home, err := os.UserHomeDir()
		if err != nil {
			return os.TempDir()
		}
		return filepath.Join(home, "AppData", "Local", "GitBuddy", "Logs")
	default: // linux and others
		if dir := os.Getenv("XDG_STATE_HOME"); dir != "" {
			return filepath.Join(dir, "gitboard")
		}
		home, err := os.UserHomeDir()
		if err != nil {
			return os.TempDir()
		}
		return filepath.Join(home, ".local", "state", "gitboard")
	}
}
