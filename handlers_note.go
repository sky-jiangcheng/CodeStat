package main

import (
	"fmt"
	"log"
	"strings"

	"gitboard/internal/db"
)

// NoteWithProject is a note joined with its parent project (global knowledge hub).
type NoteWithProject = db.NoteWithProject

// ListNotes returns all notes for a project.
func (a *App) ListNotes(projectID int64) []db.Note {
	notes, err := a.Stores.Note.List(projectID)
	if err != nil {
		log.Printf("list notes error: %v", err)
		return nil
	}
	if notes == nil {
		notes = []db.Note{}
	}
	return notes
}

// CreateNote creates a new note for a project.
func (a *App) CreateNote(projectID int64, content string) (*db.Note, error) {
	if strings.TrimSpace(content) == "" {
		return nil, fmt.Errorf("content is required")
	}
	note, err := a.Stores.Note.Create(projectID, content)
	if err == nil && a.pluginRuntime != nil {
		a.pluginRuntime.Emit("note.created", map[string]any{
			"id": note.ID, "project_id": projectID, "content": content,
		})
	}
	return note, err
}

// UpdateNote updates the content of a note.
func (a *App) UpdateNote(noteID int64, content string) error {
	if strings.TrimSpace(content) == "" {
		return fmt.Errorf("content is required")
	}
	return a.Stores.Note.Update(noteID, content)
}

// DeleteNote removes a note.
func (a *App) DeleteNote(noteID int64) error {
	return a.Stores.Note.Delete(noteID)
}

// ListAllNotes returns every note across all projects, joined with project info,
// ordered pinned first then most recently updated.
func (a *App) ListAllNotes() []NoteWithProject {
	notes, err := a.Stores.Note.ListAllWithProject()
	if err != nil {
		log.Printf("list all notes error: %v", err)
		return nil
	}
	if notes == nil {
		notes = []db.NoteWithProject{}
	}
	return notes
}

// ListAllTags returns the distinct set of tags used across all notes.
func (a *App) ListAllTags() []string {
	tags, err := a.Stores.Note.ListAllTags()
	if err != nil {
		log.Printf("list all tags error: %v", err)
		return nil
	}
	if tags == nil {
		tags = []string{}
	}
	return tags
}

// CreateNoteWithMeta creates a note with explicit title, tags, kind, and source.
func (a *App) CreateNoteWithMeta(projectID int64, title, content, tags, kind, source string) (*db.Note, error) {
	if strings.TrimSpace(content) == "" {
		return nil, fmt.Errorf("content is required")
	}
	note, err := a.Stores.Note.CreateEx(projectID, title, content, tags, kind, source)
	if err == nil && a.pluginRuntime != nil {
		a.pluginRuntime.Emit("note.created", map[string]any{
			"id": note.ID, "project_id": projectID, "title": title, "content": content, "tags": tags, "kind": kind,
		})
	}
	return note, err
}

// UpdateNoteMeta updates a note's editable metadata (title, tags, kind, pinned).
func (a *App) UpdateNoteMeta(noteID int64, title, tags, kind string, pinned bool) error {
	return a.Stores.Note.UpdateMeta(noteID, title, tags, kind, pinned)
}

// PinNote sets or clears the pinned flag on a note.
func (a *App) PinNote(noteID int64, pinned bool) error {
	return a.Stores.Note.Pin(noteID, pinned)
}

// MoveNote reassigns a note to a different project (relink shortcut).
func (a *App) MoveNote(noteID, projectID int64) error {
	return db.MoveNote(a.db, noteID, projectID)
}

// ListNoteVersions returns the recent version history for a note.
func (a *App) ListNoteVersions(noteID int64) []db.NoteVersion {
	versions, err := db.ListNoteVersions(a.db, noteID)
	if err != nil {
		log.Printf("list note versions error: %v", err)
		return nil
	}
	if versions == nil {
		return []db.NoteVersion{}
	}
	return versions
}

// GetNoteVersion returns a single version by ID.
func (a *App) GetNoteVersion(versionID int64) *db.NoteVersion {
	v, err := db.GetNoteVersion(a.db, versionID)
	if err != nil {
		log.Printf("get note version error: %v", err)
		return nil
	}
	return v
}

// RestoreNoteVersion restores a note to the content of a previous version.
func (a *App) RestoreNoteVersion(noteID, versionID int64) error {
	return db.RestoreNoteVersion(a.db, noteID, versionID)
}

// DiffNoteVersions returns a line-based diff between a version and the current note.
func (a *App) DiffNoteVersions(noteID, versionID int64) (string, error) {
	return db.DiffNoteVersions(a.db, noteID, versionID)
}
