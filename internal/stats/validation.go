package stats

import (
	"fmt"
	"regexp"
	"strings"
	"time"
)

// datePattern validates YYYY-MM-DD format.
var datePattern = regexp.MustCompile(`^\d{4}-\d{2}-\d{2}$`)

// safeAuthorPattern allows only safe characters for git author matching.
// Allowed: letters, digits, space, dot, underscore, hyphen, at-sign.
var safeAuthorPattern = regexp.MustCompile(`^[a-zA-Z0-9 ._\-@]+$`)

// ValidateDate checks that the date string matches YYYY-MM-DD format.
func ValidateDate(date string) error {
	if !datePattern.MatchString(date) {
		return fmt.Errorf("invalid date format: %s (expected YYYY-MM-DD)", date)
	}
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return fmt.Errorf("invalid date: %s", date)
	}
	// Ensure the parsed date matches the input (catches things like "0000-00-00")
	if t.Format("2006-01-02") != date {
		return fmt.Errorf("invalid date: %s", date)
	}
	return nil
}

// ValidateAuthor checks that the author string contains only safe characters.
func ValidateAuthor(author string) error {
	if author == "" {
		return nil
	}
	if !safeAuthorPattern.MatchString(author) {
		return fmt.Errorf("invalid author name: contains unsafe characters")
	}
	return nil
}

func isHex(s string) bool {
	for _, c := range s {
		if !((c >= '0' && c <= '9') || (c >= 'a' && c <= 'f')) {
			return false
		}
	}
	return true
}

func parseTimestamp(s string) int64 {
	t, _ := time.Parse("2006-01-02 15:04:05", s)
	return t.Unix()
}

func extractBranch(refString string) string {
	if strings.Contains(refString, "HEAD -> ") {
		parts := strings.Split(refString, "HEAD -> ")
		if len(parts) > 1 {
			b := strings.Split(parts[1], ",")[0]
			return strings.TrimSpace(b)
		}
	}
	return ""
}
