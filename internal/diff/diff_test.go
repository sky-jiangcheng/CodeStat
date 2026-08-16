package diff

import "testing"

func TestLinesNoChange(t *testing.T) {
	got := Lines("a\nb", "a\nb")
	want := " a\n b"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestLinesAdditionAndRemoval(t *testing.T) {
	// The backtrack prefers emitting additions first when both an addition
	// and a removal are possible; this matches the historical behaviour.
	got := Lines("a\nb\nc", "a\nx\nc")
	want := " a\n+x\n-b\n c"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestLinesPureAddition(t *testing.T) {
	got := Lines("a\nc", "a\nb\nc")
	want := " a\n+b\n c"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestLinesPureRemoval(t *testing.T) {
	got := Lines("a\nb\nc", "a\nc")
	want := " a\n-b\n c"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}

func TestLinesSameLineCount(t *testing.T) {
	got := Lines("one\ntwo", "one\nTWO")
	want := " one\n+TWO\n-two"
	if got != want {
		t.Errorf("got %q, want %q", got, want)
	}
}
