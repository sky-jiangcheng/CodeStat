package stats

import (
	"context"
	"os/exec"
	"path/filepath"
	"strings"
)

// InferRepoMeta derives display name, git user, and organization from a
// repository path and optional known author. It uses git config for the
// user and falls back to directory-based heuristics.
func InferRepoMeta(repoPath, author string) RepoMetaInfo {
	var m RepoMetaInfo
	base := filepath.Base(repoPath)
	m.DisplayName = base
	if author != "" {
		m.User = author
	} else {
		// Try git config user.name, bounded by the shared query timeout so a
		// hung or unreachable working tree cannot block the scan/repo discovery path.
		ctx, cancel := context.WithTimeout(context.Background(), QueryTimeout)
		defer cancel()
		out, err := exec.CommandContext(ctx, "git", "-C", repoPath, "config", "user.name").Output()
		if err == nil {
			m.User = strings.TrimSpace(string(out))
		}
	}
	// Derive organization from the parent directory name.
	parent := filepath.Base(filepath.Dir(repoPath))
	if parent != "" && parent != "." && parent != "/" {
		m.Organization = parent
	}
	return m
}
