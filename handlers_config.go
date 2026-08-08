package main

import (
	"fmt"
	"strconv"
)

// ConfigData holds the application configuration sent to the frontend.
type ConfigData struct {
	Config    map[string]string `json:"config"`
	ScanRoots []string          `json:"scan_roots"`
}

// GetConfig returns all configuration settings and scan roots.
func (a *App) GetConfig() (*ConfigData, error) {
	configs, err := a.Stores.Config.All()
	if err != nil {
		return nil, fmt.Errorf("failed to load config")
	}
	roots, _ := a.Stores.ScanRoot.Get()
	return &ConfigData{Config: configs, ScanRoots: roots}, nil
}

// UpdateConfig sets a single configuration key-value pair.
func (a *App) UpdateConfig(key, value string) error {
	allowed := map[string]bool{"daily_code_standard": true, "scan_depth": true, "git_author": true, "auto_import": true}
	if !allowed[key] {
		return fmt.Errorf("unknown config key: %s", key)
	}
	// Validate numeric configs
	if key != "git_author" {
		if _, err := strconv.Atoi(value); err != nil {
			return fmt.Errorf("config value must be a number")
		}
	}
	return a.Stores.Config.Set(key, value)
}

// UpdateScanRoots replaces the entire scan root list atomically.
func (a *App) UpdateScanRoots(scanRoots []string) error {
	if err := a.Stores.ScanRoot.Replace(scanRoots); err != nil {
		return fmt.Errorf("failed to update scan roots: %w", err)
	}
	return nil
}
