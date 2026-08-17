package main

import (
	"embed"
	"log"
	"net/http"
	"os"
	"strings"

	"gitboard/internal/app"
	"gitboard/internal/db"
	"gitboard/internal/platform"
	"gitboard/internal/service"
	"gitboard/internal/version"

	"github.com/wailsapp/wails/v2"
	"github.com/wailsapp/wails/v2/pkg/options"
	"github.com/wailsapp/wails/v2/pkg/options/assetserver"
)

//go:embed all:web/dist
var assets embed.FS

func main() {
	log.Printf("GitBuddy %s starting...", version.Version)

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

	// Create the service core and the thin Wails binding layer over it.
	a := app.New(service.New(database, gitUser))

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
					// Note: unsafe-inline on script-src is required for PWA's registerSW.js.
					// unsafe-eval is intentionally omitted; if dynamic eval is needed,
					// refactor to use explicit Function() calls with a nonce instead.
					w.Header().Set("Content-Security-Policy",
						"default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self' ws: wss: https:; frame-ancestors 'none'; base-uri 'self'; form-action 'self'")
					w.Header().Set("X-Content-Type-Options", "nosniff")
					w.Header().Set("X-Frame-Options", "DENY")
					w.Header().Set("Referrer-Policy", "strict-origin-when-cross-origin")
					w.Header().Set("Permissions-Policy", "camera=(), microphone=(), geolocation=(), acceleration=()")
					next.ServeHTTP(w, r)
				})
			},
		},
		OnStartup:  a.Startup,
		OnShutdown: a.Shutdown,
		Bind: []interface{}{
			a,
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

func init() {
	// Ensure PATH includes common binary directories (git may not be in PATH
	// when launched from Finder).
	ensurePath()
	// Redirect logs to a file so crashes can be diagnosed when the app is
	// launched outside a terminal.
	setupLogging()
}

func ensurePath() {
	path := os.Getenv("PATH")
	if path == "" {
		os.Setenv("PATH", "/usr/local/bin:/usr/bin:/bin:/usr/sbin:/sbin")
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
	logFile := platform.GetLogPath()
	f, err := os.OpenFile(logFile, os.O_CREATE|os.O_WRONLY|os.O_APPEND, 0640)
	if err == nil {
		log.SetOutput(f)
	}
	log.SetFlags(log.LstdFlags | log.Lshortfile)
	log.Printf("=== GitBuddy log started ===")
	log.Printf("log file: %s", logFile)
	log.Printf("PATH=%s", os.Getenv("PATH"))
}
