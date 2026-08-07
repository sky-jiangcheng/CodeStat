package runtime

import (
	"fmt"
	"reflect"

	"gitboard/internal/core/plugin"

	"github.com/traefik/yaegi/interp"
	"github.com/traefik/yaegi/stdlib"
)

// exportedTypes is the set of host symbols exposed to plugin scripts via the
// import path "gitboard/internal/core/plugin". Scripts use plugin.Context and
// plugin.ImportDoc.
var exportedTypes = interp.Exports{
	"gitboard/internal/core/plugin/plugin": {
		"Context":   reflect.ValueOf((*Context)(nil)),
		"Event":     reflect.ValueOf(plugin.Event{}),
		"ImportDoc": reflect.ValueOf(plugin.ImportDoc{}),
	},
}

// script wraps a yaegi interpreter bound to one plugin source file.
type script struct {
	i *interp.Interpreter
}

// compileScript evaluates a plugin source file and prepares it for symbol
// lookup. Compilation errors are returned verbatim.
func compileScript(src string) (*script, error) {
	i := interp.New(interp.Options{})
	i.Use(stdlib.Symbols)
	i.Use(exportedTypes)

	if _, err := i.Eval(src); err != nil {
		return nil, fmt.Errorf("compile: %w", err)
	}
	return &script{i: i}, nil
}

// funcValue looks up a package-level symbol such as "main.Name".
func (s *script) funcValue(sym string) (reflect.Value, error) {
	v, err := s.i.Eval(sym)
	if err != nil {
		return reflect.Value{}, err
	}
	if !v.IsValid() || v.Kind() != reflect.Func {
		return reflect.Value{}, fmt.Errorf("%s is not a function", sym)
	}
	return v, nil
}
