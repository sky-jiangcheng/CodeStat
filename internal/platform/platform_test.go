package platform

import (
	"path/filepath"
	"runtime"
	"strings"
	"testing"
)

func TestDefaultScanRoots(t *testing.T) {
	roots := DefaultScanRoots()
	if len(roots) == 0 {
		t.Fatal("DefaultScanRoots returned empty slice")
	}
	for _, root := range roots {
		if root == "" {
			t.Error("DefaultScanRoots contains empty path")
		}
	}
}

func TestGetWindowsDrives(t *testing.T) {
	drives := getWindowsDrives()
	if runtime.GOOS != "windows" && len(drives) != 0 {
		t.Error("getWindowsDrives should return nil on non-Windows")
	}
}

func TestGetGitUserName(t *testing.T) {
	name := GetGitUserName()
	if name == "" {
		t.Error("GetGitUserName returned empty string")
	}
	if name == "unknown" {
		t.Log("Git user name not configured, using fallback")
	}
}

func TestGetDbPath(t *testing.T) {
	path := GetDbPath()
	if path == "" {
		t.Fatal("GetDbPath returned empty string")
	}
	if !strings.HasSuffix(path, filepath.Join("gitboard", "dashboard.db")) {
		t.Errorf("GetDbPath = %s, want it inside a gitboard directory ending with dashboard.db", path)
	}
}

func TestGetLogPath(t *testing.T) {
	path := GetLogPath()
	if path == "" {
		t.Fatal("GetLogPath returned empty string")
	}
	if !strings.HasSuffix(path, "gitboard.log") {
		t.Errorf("GetLogPath = %s, want it to end with gitboard.log", path)
	}
}
