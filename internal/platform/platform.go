// Package platform centralises OS-specific behaviour: default scan roots,
// user data locations (database, plugins, log file) and git user detection.
//
// User data paths are stable across versions: an installation that already
// has a "gitboard" data directory is renamed to dirName on first launch after
// the GitBoard -> GitBuddy rename, so the database, plugins and logs carry
// over instead of being orphaned.
package platform

import (
	"os"
	"os/exec"
	"path/filepath"
	"runtime"
	"strings"
	"sync"
)

// dirName is the user data directory and the log file basename.
const dirName = "gitbuddy"

// legacyDirName is the data directory used before the GitBoard -> GitBuddy
// rename. The spelling is intentional: it names data written by older builds
// and is only read by the migration below.
const legacyDirName = "gitboard"

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

var migrateLegacyOnce sync.Once

// migrateLegacyData renames the pre-rename "gitboard" data directory to
// dirName, moving the database and plugins across. It is a no-op on a fresh
// install or once the rename has happened. Failures are ignored on purpose:
// a move that cannot complete (permissions, cross-device) must not stop the
// app from starting, and the old directory stays in place to be moved by hand.
func migrateLegacyData() {
	configDir, err := os.UserConfigDir()
	if err != nil {
		return
	}
	old := filepath.Join(configDir, legacyDirName)
	if _, err := os.Stat(old); err != nil {
		return
	}
	current := filepath.Join(configDir, dirName)
	if _, err := os.Stat(current); err == nil {
		return
	}
	_ = os.Rename(old, current)
}

// GetDbPath returns the path to the SQLite database file.
func GetDbPath() string {
	migrateLegacyOnce.Do(migrateLegacyData)

	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = filepath.Join(os.TempDir(), dirName)
	}
	dir := filepath.Join(configDir, dirName)
	if err := os.MkdirAll(dir, 0750); err != nil {
		return filepath.Join(os.TempDir(), dirName+".db")
	}
	return filepath.Join(dir, "dashboard.db")
}

// GetPluginsDir returns the directory that holds plugin directories
// (one subdirectory per plugin, each containing plugin.go).
func GetPluginsDir() string {
	configDir, err := os.UserConfigDir()
	if err != nil {
		configDir = filepath.Join(os.TempDir(), dirName)
	}
	dir := filepath.Join(configDir, dirName, "plugins")
	if err := os.MkdirAll(dir, 0750); err != nil {
		return filepath.Join(os.TempDir(), dirName+"-plugins")
	}
	return dir
}

// migrateLegacyLog renames the log file left behind by earlier versions
// (gitboard.log -> gitbuddy.log). It runs after the log directory is known,
// which covers every platform: on Windows the log lives inside the config
// directory that migrateLegacyData already renamed, so only the file name is
// left to fix there.
func migrateLegacyLog(dir string) {
	old := filepath.Join(dir, legacyDirName+".log")
	if _, err := os.Stat(old); err != nil {
		return
	}
	current := filepath.Join(dir, dirName+".log")
	if _, err := os.Stat(current); err == nil {
		return
	}
	_ = os.Rename(old, current)
}

// GetLogPath returns the platform-appropriate log file path.
//
//	darwin:  ~/Library/Logs/gitbuddy.log
//	windows: %APPDATA%\gitbuddy\logs\gitbuddy.log
//	linux:   $XDG_STATE_HOME/gitbuddy/gitbuddy.log (default ~/.local/state/...)
func GetLogPath() string {
	var dir string
	switch runtime.GOOS {
	case "darwin":
		home, err := os.UserHomeDir()
		if err != nil {
			return filepath.Join(os.TempDir(), dirName+".log")
		}
		dir = filepath.Join(home, "Library", "Logs")
	case "windows":
		appData, err := os.UserConfigDir()
		if err != nil {
			return filepath.Join(os.TempDir(), dirName+".log")
		}
		dir = filepath.Join(appData, dirName, "logs")
	default:
		state := os.Getenv("XDG_STATE_HOME")
		if state == "" {
			home, err := os.UserHomeDir()
			if err != nil {
				return filepath.Join(os.TempDir(), dirName+".log")
			}
			state = filepath.Join(home, ".local", "state")
		}
		dir = filepath.Join(state, dirName)
	}
	if err := os.MkdirAll(dir, 0750); err != nil {
		return filepath.Join(os.TempDir(), dirName+".log")
	}
	migrateLegacyLog(dir)
	return filepath.Join(dir, dirName+".log")
}
