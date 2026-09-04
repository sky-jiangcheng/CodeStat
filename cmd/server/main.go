// Command server runs GitBuddy as a headless HTTP service, exposing the shared
// internal/service business logic over a JSON API. It is the bridge that lets
// the DeepSeek Harness dsh-plugin (and any other HTTP client) reuse the exact
// same analysis code the desktop App uses, without duplicating logic.
//
// Usage:
//
//	gitbuddy server [--port 18765]
//	GITBUDDY_HTTP_PORT=18765 gitbuddy server
//
// The server binds to 127.0.0.1 only — it is a local agent, not a public
// service. The dsh-plugin spawns this process and connects to the chosen port.
package main

import (
	"flag"
	"log"
	"net/http"
	"os"

	"gitbuddy/internal/db"
	"gitbuddy/internal/httpapi"
	"gitbuddy/internal/platform"
	"gitbuddy/internal/service"
	"gitbuddy/internal/version"
)

func main() {
	port := flag.String("port", envOr("GITBUDDY_HTTP_PORT", "18765"), "HTTP port for the headless API (loopback only)")
	flag.Parse()

	log.Printf("GitBuddy headless server %s starting on 127.0.0.1:%s", version.Version, *port)

	database, err := db.InitDB(platform.GetDbPath())
	if err != nil {
		log.Fatalf("Failed to initialize database: %v", err)
	}

	gitUser := platform.GetGitUserName()
	svc := service.New(database, gitUser)

	mux := httpapi.New(svc)
	srv := &http.Server{Addr: "127.0.0.1:" + *port, Handler: mux}

	// Best-effort cleanup on exit (e.g. when the plugin stops the process).
	defer func() { _ = svc.Close() }()

	log.Printf("GitBuddy headless API listening at http://127.0.0.1:%s", *port)
	if err := srv.ListenAndServe(); err != nil && err != http.ErrServerClosed {
		log.Fatalf("HTTP server error: %v", err)
	}
}

func envOr(key, def string) string {
	if v := os.Getenv(key); v != "" {
		return v
	}
	return def
}
