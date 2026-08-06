// Package kb defines the "Knowledge Base" domain model used by the plugin
// protocol (kb:space:* and kb:doc:* scopes). The existing GitBoard model uses
// "project" and "note" names; this package exposes the plugin-aligned names
// (Space = project, Doc = note) along with a bidirectional mapper so the two
// models can coexist during the transition.
package kb

import (
	"gitboard/internal/core/storage"
)

// Space is the plugin-facing counterpart of a storage.Project.
// A Space is a container for zero or more Docs.
type Space struct {
	ID            int64  `json:"id"`
	Name          string `json:"name"`
	RootPath      string `json:"root_path"`
	LevelOverride int    `json:"level_override"`
	IsAutoGrouped bool   `json:"is_auto_grouped"`
	IsStarred     bool   `json:"is_starred"`
	Collected     bool   `json:"collected"`
	CollectedAt   string `json:"collected_at,omitempty"`
	CreatedAt     string `json:"created_at"`
}

// Doc is the plugin-facing counterpart of a storage.Note.
// A Doc always belongs to exactly one Space.
type Doc struct {
	ID        int64  `json:"id"`
	SpaceID   int64  `json:"space_id"`
	Title     string `json:"title"`
	Content   string `json:"content"`
	Tags      string `json:"tags"`
	Kind      string `json:"kind"`
	Pinned    bool   `json:"pinned"`
	Source    string `json:"source"`
	SortOrder int    `json:"sort_order"`
	CreatedAt string `json:"created_at"`
	UpdatedAt string `json:"updated_at"`
}

// DocWithSpace joins a Doc to its parent Space name.
type DocWithSpace struct {
	Doc
	SpaceName string `json:"space_name"`
}

// --------------------------------------------------------------------------
// Mappers between the legacy model and the kb domain.
// --------------------------------------------------------------------------

// ProjectToSpace converts a storage.Project (previously "project" domain) to
// a kb.Space. The two structs share 1:1 field mapping; the function exists
// to keep the two models formally decoupled.
func ProjectToSpace(p *storage.Project) *Space {
	if p == nil {
		return nil
	}
	return &Space{
		ID:            p.ID,
		Name:          p.Name,
		RootPath:      p.RootPath,
		LevelOverride: p.LevelOverride,
		IsAutoGrouped: p.IsAutoGrouped,
		IsStarred:     p.IsStarred,
		Collected:     p.Collected,
		CollectedAt:   p.CollectedAt,
		CreatedAt:     p.CreatedAt,
	}
}

// SpaceToProject converts a kb.Space back to a storage.Project value.
func SpaceToProject(s *Space) *storage.Project {
	if s == nil {
		return nil
	}
	return &storage.Project{
		ID:            s.ID,
		Name:          s.Name,
		RootPath:      s.RootPath,
		LevelOverride: s.LevelOverride,
		IsAutoGrouped: s.IsAutoGrouped,
		IsStarred:     s.IsStarred,
		Collected:     s.Collected,
		CollectedAt:   s.CollectedAt,
		CreatedAt:     s.CreatedAt,
	}
}

// NoteToDoc converts a storage.Note to a kb.Doc.
func NoteToDoc(n *storage.Note) *Doc {
	if n == nil {
		return nil
	}
	return &Doc{
		ID:        n.ID,
		SpaceID:   n.ProjectID,
		Title:     n.Title,
		Content:   n.Content,
		Tags:      n.Tags,
		Kind:      n.Kind,
		Pinned:    n.Pinned,
		Source:    n.Source,
		SortOrder: n.SortOrder,
		CreatedAt: n.CreatedAt,
		UpdatedAt: n.UpdatedAt,
	}
}

// DocToNote converts a kb.Doc back to a storage.Note.
func DocToNote(d *Doc) *storage.Note {
	if d == nil {
		return nil
	}
	return &storage.Note{
		ID:        d.ID,
		ProjectID: d.SpaceID,
		Title:     d.Title,
		Content:   d.Content,
		Tags:      d.Tags,
		Kind:      d.Kind,
		Pinned:    d.Pinned,
		Source:    d.Source,
		SortOrder: d.SortOrder,
		CreatedAt: d.CreatedAt,
		UpdatedAt: d.UpdatedAt,
	}
}

// NoteWithProjectToDocWithSpace converts db.NoteWithProject to DocWithSpace.
func NoteWithProjectToDocWithSpace(np *storage.NoteWithProject) *DocWithSpace {
	if np == nil {
		return nil
	}
	return &DocWithSpace{
		Doc: Doc{
			ID:        np.ID,
			SpaceID:   np.ProjectID,
			Title:     np.Title,
			Content:   np.Content,
			Tags:      np.Tags,
			Kind:      np.Kind,
			Pinned:    np.Pinned,
			Source:    np.Source,
			SortOrder: np.SortOrder,
			CreatedAt: np.CreatedAt,
			UpdatedAt: np.UpdatedAt,
		},
		SpaceName: np.ProjectName,
	}
}

// --- Slice-level helpers (kept free of generics for Go 1.20 compat) --------

func ProjectsToSpaces(ps []storage.Project) []Space {
	if ps == nil {
		return nil
	}
	out := make([]Space, 0, len(ps))
	for i := range ps {
		out = append(out, *ProjectToSpace(&ps[i]))
	}
	return out
}

func NotesToDocs(ns []storage.Note) []Doc {
	if ns == nil {
		return nil
	}
	out := make([]Doc, 0, len(ns))
	for i := range ns {
		out = append(out, *NoteToDoc(&ns[i]))
	}
	return out
}

func DocsWithSpaces(list []storage.NoteWithProject) []DocWithSpace {
	if list == nil {
		return nil
	}
	out := make([]DocWithSpace, 0, len(list))
	for i := range list {
		out = append(out, *NoteWithProjectToDocWithSpace(&list[i]))
	}
	return out
}
