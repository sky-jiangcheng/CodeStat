package stats

import (
	"context"
	"fmt"
	"os/exec"
	"sort"
	"strings"
	"time"
)

// QueryStatsRange queries daily stats for a range of dates and returns per-day aggregates.
func QueryStatsRange(repoPath, startDate, endDate, author string) ([]DailyEntry, error) {
	if err := ValidateDate(startDate); err != nil {
		return nil, err
	}
	if err := ValidateDate(endDate); err != nil {
		return nil, err
	}
	if err := ValidateAuthor(author); err != nil {
		return nil, err
	}

	ctx, cancel := context.WithTimeout(context.Background(), 120*time.Second)
	defer cancel()

	args := []string{
		"log",
		"--after=" + startDate + " 00:00:00",
		"--before=" + endDate + " 23:59:59",
		"--pretty=format:%ad",
		"--date=short",
		"--shortstat",
	}
	if author != "" {
		args = append(args, "--author="+author)
	}

	//nolint:gosec
	cmd := exec.CommandContext(ctx, "git", args...)
	cmd.Dir = repoPath
	out, err := cmd.Output()
	if err != nil {
		if ctx.Err() == context.DeadlineExceeded {
			return nil, fmt.Errorf("query timed out")
		}
		return nil, err
	}

	agg := make(map[string]*DailyEntry)
	lines := strings.Split(string(out), "\n")
	var currentDate string
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if datePattern.MatchString(line) {
			currentDate = line
			if _, ok := agg[currentDate]; !ok {
				agg[currentDate] = &DailyEntry{Date: currentDate}
			}
			agg[currentDate].Commits++
			continue
		}
		if currentDate != "" {
			files, added, deleted := parseStatLine(line)
			agg[currentDate].FilesChanged += files
			agg[currentDate].LinesAdded += added
			agg[currentDate].LinesDeleted += deleted
		}
	}

	if len(agg) == 0 {
		return nil, nil
	}

	entries := make([]DailyEntry, 0, len(agg))
	for _, e := range agg {
		entries = append(entries, *e)
	}
	sort.Slice(entries, func(i, j int) bool {
		return entries[i].Date < entries[j].Date
	})

	return entries, nil
}
