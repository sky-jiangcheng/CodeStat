package main

import (
	"encoding/json"
	"path/filepath"
	"strings"
)

// pathBase returns the last element of a path.
func pathBase(p string) string {
	return filepath.Base(p)
}

// pathDir returns all but the last element of a path.
func pathDir(p string) string {
	return filepath.Dir(p)
}

// jsonUnmarshalSafe unmarshals JSON into v, silently ignoring errors.
func jsonUnmarshalSafe(data string, v interface{}) {
	_ = json.Unmarshal([]byte(data), v)
}

// marshalJSON marshals v to JSON bytes, returning nil on error.
func marshalJSON(v interface{}) ([]byte, error) {
	return json.Marshal(v)
}

// escapeLikeQuery escapes special LIKE characters for use with ESCAPE '\\'.
func escapeLikeQuery(s string) string {
	s = strings.ReplaceAll(s, `\`, `\\`)
	s = strings.ReplaceAll(s, `%`, `\%`)
	s = strings.ReplaceAll(s, `_`, `\_`)
	return s
}

// csvSafe escapes a value for safe CSV output, preventing CSV injection.
// Prefixes formula-triggering characters (=, +, -, @, \t, \n) with a single quote.
func csvSafe(s string) string {
	if len(s) == 0 {
		return s
	}
	switch s[0] {
	case '=', '+', '-', '@', '\t', '\n':
		return "'" + s
	}
	return s
}
