// Package platform centralises OS-specific behaviour: default scan roots,
// user data locations (database, plugins, log file) and git user detection.
//
// User data paths are stable across versions; they keep the historical
// "gitboard" directory names so existing installations keep their data after
// upgrades.
package platform

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
)

// DefaultScanRoots returns platform-specific default scan root directories.
// Windows: all drive letters except C: (the system drive).
// macOS / Linux: the user's home directory.
func DefaultScanRoots() []string {
	home, _ := os.UserHomeDir()

	switch runtime.GOOS {
	case "windows":
		roots := []string{}
		for _, drive := range getWindowsDrives() {
			upper := strings.ToUpper(drive)
			if upper != "C:" && upper != "C:\\" {
				roots = append(roots, drive)
			}
		}
		if len(roots) == 0 {
			roots = append(roots, home)
		}
		return roots
	default: // darwin, linux and others
		return []string{home}
	}
}

// getWindowsDrives enumerates available drive letters on Windows.
// On non-Windows platforms, returns an empty slice.
func getWindowsDrives() []string {
	if runtime.GOOS != "windows" {
		return nil
	}
	drives := []string{}
	for c := 'A'; c <= 'Z'; c++ {
		path := string(c) + ":\\"
		if _, err := os.Stat(path); err == nil {
			drives = append(drives, path)
		}
	}
	return drives
}

// GetGitUserName returns the git user.name from global or local config.
func GetGitUserName() string {
	cmd := exec.Command("git", "config", "user.name")
	out, err := cmd.Output()
	if err != nil {
		// fallback to OS username
		if u, e := os.UserHomeDir(); e == nil {
			return filepath.Base(u)
		}
		return "unknown"
	}
	return strings.TrimSpace(string(out))
}

// GetDbPath returns the path to the SQLite database file.
func GetDbPath() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = filepath.Join(os.TempDir(), "gitboard")
	}
	dir := filepath.Join(configDir, "gitboard")
	if err := os.MkdirAll(dir, 0750); err != nil {
		return filepath.Join(os.TempDir(), "gitboard.db")
	}
	return filepath.Join(dir, "dashboard.db")
}

// GetPluginsDir returns the directory that holds plugin directories
// (one subdirectory per plugin, each containing plugin.go).
func GetPluginsDir() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = filepath.Join(os.TempDir(), "gitboard")
	}
	dir := filepath.Join(configDir, "gitboard", "plugins")
	if err := os.MkdirAll(dir, 0750); err != nil {
		return filepath.Join(os.TempDir(), "gitboard-plugins")
	}
	return dir
}

// GetLogPath returns the platform-appropriate log file path. The log file
// itself is always named gitboard.log for continuity with earlier versions.
//
//	darwin:  ~/Library/Logs/gitboard.log
//	windows: %APPDATA%\gitboard\logs\gitboard.log
//	linux:   $XDG_STATE_HOME/gitboard/gitboard.log (default ~/.local/state/...)
func GetLogPath() string {
	var dir string
	switch runtime.GOOS {
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return filepath.Join(os.TempDir(), "gitboard.log")
		}
		dir = filepath.Join(home, "Library", "Logs")
	case "windows":
		appData, err := os.UserConfigDir()
		if err != nil {
			return filepath.Join(os.TempDir(), "gitboard.log")
		}
		dir = filepath.Join(appData, "gitboard", "logs")
	default:
		state := os.Getenv("XDG_STATE_HOME")
		if state == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return filepath.Join(os.TempDir(), "gitboard.log")
			}
			state = filepath.Join(home, ".local", "state")
		}
		dir = filepath.Join(state, "gitboard")
	}
	if err := os.MkdirAll(dir, 0750); err != nil {
		return filepath.Join(os.TempDir(), "gitboard.log")
	}
	return filepath.Join(dir, "gitboard.log")
}
