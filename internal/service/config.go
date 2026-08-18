package service

import (
	"fmt"
	"strconv"

	"gitboard/internal/db"
)

// ConfigData holds the application configuration sent to the frontend.
type ConfigData struct {
	Config    map[string]string `json:"config"`
	ScanRoots []string          `json:"scan_roots"`
}

// allowedConfigKeys is the allow-list of user-settable configuration keys.
var allowedConfigKeys = map[string]bool{
	"daily_code_standard": true,
	"scan_depth":          true,
	"git_author":          true,
	"auto_import":         true,
}

// GetConfig returns all configuration settings and scan roots.
func (s *Service) GetConfig() (*ConfigData, error) {
	configs, err := db.GetAllConfigs(s.db)
	if err != nil {
		return nil, fmt.Errorf("failed to load config: %w", err)
	}
	roots, _ := db.GetScanRoots(s.db)
	return &ConfigData{Config: configs, ScanRoots: roots}, nil
}

// UpdateConfig sets a single configuration key-value pair after validating
// the key against the allow-list and numeric values.
func (s *Service) UpdateConfig(key, value string) error {
	if !allowedConfigKeys[key] {
		return fmt.Errorf("unknown config key: %s", key)
	}
	if key != "git_author" {
		if _, err := strconv.Atoi(value); err != nil {
			return fmt.Errorf("config value must be a number")
		}
	}
	if err := db.SetConfig(s.db, key, value); err != nil {
		return err
	}
	// git_author is applied immediately so "mine" stats, heatmap and recent
	// commits reflect the new author without a restart.
	if key == "git_author" {
		s.setGitUser(value)
	}
	return nil
}

// UpdateScanRoots replaces the entire scan root list atomically.
func (s *Service) UpdateScanRoots(scanRoots []string) error {
	if err := db.ReplaceScanRoots(s.db, scanRoots); err != nil {
		return fmt.Errorf("failed to update scan roots: %w", err)
	}
	return nil
}
