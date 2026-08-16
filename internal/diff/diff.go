// Package diff implements the line-based diff used to compare note versions.
package diff

import "strings"

// Lines produces a simple line-based diff between old and new content using
// the longest common subsequence. Output lines are prefixed with ' ' (context),
// '-' (removal) or '+' (addition). It is O(n*m) in space, which is acceptable
// for note-sized content.
func Lines(old, new string) string {
	oldLines := strings.Split(old, "\n")
	newLines := strings.Split(new, "\n")
	m, n := len(oldLines), len(newLines)

	// Build LCS table.
	dp := make([][]int, m+1)
	for i := range dp {
		dp[i] = make([]int, n+1)
	}
	for i := m - 1; i >= 0; i-- {
		for j := n - 1; j >= 0; j-- {
			if oldLines[i] == newLines[j] {
				dp[i][j] = dp[i+1][j+1] + 1
			} else if dp[i+1][j] > dp[i][j+1] {
				dp[i][j] = dp[i+1][j]
			} else {
				dp[i][j] = dp[i][j+1]
			}
		}
	}

	// Backtrack to produce the diff.
	var result []string
	i, j := 0, 0
	for i < m || j < n {
		switch {
		case i < m && j < n && oldLines[i] == newLines[j]:
			result = append(result, " "+oldLines[i])
			i++
			j++
		case j < n && (i == m || dp[i][j+1] >= dp[i+1][j]):
			result = append(result, "+"+newLines[j])
			j++
		default:
			result = append(result, "-"+oldLines[i])
			i++
		}
	}
	return strings.Join(result, "\n")
}
