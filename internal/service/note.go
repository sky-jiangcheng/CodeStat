package service

import (
	"fmt"
	"log"
	"strings"

	"gitboard/internal/db"
	"gitboard/internal/domain"
)

// ListNotes returns all notes for a project.
func (s *Service) ListNotes(projectID int64) []domain.Note {
	notes, err := db.ListNotes(s.db, projectID)
	if err != nil {
		log.Printf("list notes error: %v", err)
		return nil
	}
	if notes == nil {
		notes = []domain.Note{}
	}
	return notes
}

// CreateNote creates a new note for a project.
func (s *Service) CreateNote(projectID int64, content string) (*domain.Note, error) {
	if strings.TrimSpace(content) == "" {
		return nil, fmt.Errorf("content is required")
	}
	note, err := db.CreateNote(s.db, projectID, content)
	if err == nil && s.rt != nil {
		s.rt.Emit("note.created", map[string]any{
			"id": note.ID, "project_id": projectID, "content": content,
		})
	}
	return note, err
}

// CreateNoteWithMeta creates a note with explicit title, tags, kind and source.
func (s *Service) CreateNoteWithMeta(projectID int64, title, content, tags, kind, source string) (*domain.Note, error) {
	if strings.TrimSpace(content) == "" {
		return nil, fmt.Errorf("content is required")
	}
	note, err := db.CreateNoteEx(s.db, projectID, title, content, tags, kind, source)
	if err == nil && s.rt != nil {
		s.rt.Emit("note.created", map[string]any{
			"id": note.ID, "project_id": projectID, "title": title, "content": content, "tags": tags, "kind": kind,
		})
	}
	return note, err
}

// UpdateNote updates the content of a note.
func (s *Service) UpdateNote(noteID int64, content string) error {
	if strings.TrimSpace(content) == "" {
		return fmt.Errorf("content is required")
	}
	return db.UpdateNote(s.db, noteID, content)
}

// DeleteNote removes a note.
func (s *Service) DeleteNote(noteID int64) error {
	return db.DeleteNote(s.db, noteID)
}

// UpdateNoteMeta updates a note's editable metadata (title, tags, kind, pinned).
func (s *Service) UpdateNoteMeta(noteID int64, title, tags, kind string, pinned bool) error {
	return db.UpdateNoteMeta(s.db, noteID, title, tags, kind, pinned)
}

// PinNote sets or clears the pinned flag on a note.
func (s *Service) PinNote(noteID int64, pinned bool) error {
	return db.PinNote(s.db, noteID, pinned)
}

// MoveNote reassigns a note to a different project.
func (s *Service) MoveNote(noteID, projectID int64) error {
	return db.MoveNote(s.db, noteID, projectID)
}

// ListAllNotes returns every note across all projects, joined with project
// info, ordered pinned first then most recently updated.
func (s *Service) ListAllNotes() []domain.NoteWithProject {
	notes, err := db.ListAllNotes(s.db)
	if err != nil {
		log.Printf("list all notes error: %v", err)
		return nil
	}
	if notes == nil {
		notes = []domain.NoteWithProject{}
	}
	return notes
}

// ListAllTags returns the distinct set of tags used across all notes.
func (s *Service) ListAllTags() []string {
	tags, err := db.ListAllTags(s.db)
	if err != nil {
		log.Printf("list all tags error: %v", err)
		return nil
	}
	if tags == nil {
		tags = []string{}
	}
	return tags
}

// ListNoteVersions returns the recent version history for a note.
func (s *Service) ListNoteVersions(noteID int64) []domain.NoteVersion {
	versions, err := db.ListNoteVersions(s.db, noteID)
	if err != nil {
		log.Printf("list note versions error: %v", err)
		return nil
	}
	if versions == nil {
		return []domain.NoteVersion{}
	}
	return versions
}

// RestoreNoteVersion restores a note to the content of a previous version.
func (s *Service) RestoreNoteVersion(noteID, versionID int64) error {
	return db.RestoreNoteVersion(s.db, noteID, versionID)
}

// DiffNoteVersions returns a line-based diff between a version and the
// current note.
func (s *Service) DiffNoteVersions(noteID, versionID int64) (string, error) {
	return db.DiffNoteVersions(s.db, noteID, versionID)
}

// GetNote returns a single note by ID for read-only consumers (CLI / MCP).
func (s *Service) GetNote(noteID int64) (*domain.Note, error) {
	return db.GetNoteByID(s.db, noteID)
}
