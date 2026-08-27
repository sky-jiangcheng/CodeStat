package stats

import "time"

// GetTodayDate returns today's date as YYYY-MM-DD.
func GetTodayDate() string {
	return time.Now().Format("2006-01-02")
}

// GetYesterdayDate returns yesterday's date as YYYY-MM-DD.
func GetYesterdayDate() string {
	return time.Now().AddDate(0, 0, -1).Format("2006-01-02")
}

// IsWorkday reports whether the given YYYY-MM-DD date falls on a weekday.
func IsWorkday(date string) bool {
	t, err := time.Parse("2006-01-02", date)
	if err != nil {
		return true
	}
	day := t.Weekday()
	return day != time.Saturday && day != time.Sunday
}
