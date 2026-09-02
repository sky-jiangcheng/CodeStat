package service

import (
	"encoding/json"
	"strings"
	"testing"
)

// Regression: a nil scan-root slice serialises to JSON null, and the settings
// page spreads/filters the field directly ([...data.scan_roots]), so adding the
// very first scan root threw a TypeError. Every slice/map in the config payload
// must serialise as an empty collection, never null.
func TestGetConfig_NoNullCollections(t *testing.T) {
	svc, _ := setupService(t)

	cfg, err := svc.GetConfig()
	if err != nil {
		t.Fatalf("GetConfig: %v", err)
	}
	if cfg.ScanRoots == nil {
		t.Error("ScanRoots is nil -> serialises to null")
	}
	if cfg.Config == nil {
		t.Error("Config is nil -> serialises to null")
	}

	b, err := json.Marshal(cfg)
	if err != nil {
		t.Fatalf("marshal config: %v", err)
	}
	if strings.Contains(string(b), "null") {
		t.Errorf("config JSON contains null: %s", b)
	}
}
