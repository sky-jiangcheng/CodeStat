package kb

import "gitboard/internal/core/storage"

// Facade is the single entry point for the Knowledge Base domain. Plugins and
// the REST API should only talk to this interface (never to raw ProjectStore
// or NoteStore) so that the kb:space:* and kb:doc:* permission scopes map
// cleanly to the method list below.
type Facade interface {
	// --- Space scopes (kb:space:read / kb:space:write) ---
	ListSpaces(starredOnly bool) ([]Space, error)
	GetSpace(id int64) (*Space, error)
	SearchSpaces(query string) ([]Space, error)
	ToggleSpaceStar(id int64) (bool, error)

	// --- Doc scopes (kb:doc:read / kb:doc:write) ---
	ListDocs(spaceID int64) ([]Doc, error)
	ListAllDocs() ([]DocWithSpace, error)
	ListAllDocTags() ([]string, error)
	CreateDoc(spaceID int64, content string) (*Doc, error)
	CreateDocEx(spaceID int64, title, content, tags, kind, source string) (*Doc, error)
	UpdateDoc(id int64, content string) error
	UpdateDocMeta(id int64, title, tags, kind string, pinned bool) error
	PinDoc(id int64, pinned bool) error
	DeleteDoc(id int64) error
	SearchDocs(query string) ([]storage.SearchHit, error)
}

// DefaultFacade is the default Facade implementation that delegates to the
// underlying storage.Stores bundle. No state of its own; fully stateless.
type DefaultFacade struct {
	s storage.Stores
}

// Compile-time check.
var _ Facade = (*DefaultFacade)(nil)

// NewFacade constructs a DefaultFacade wrapping s.
func NewFacade(s storage.Stores) *DefaultFacade {
	return &DefaultFacade{s: s}
}

// -- Space operations ---------------------------------------------------------

func (f *DefaultFacade) ListSpaces(starredOnly bool) ([]Space, error) {
	var (
		list []storage.Project
		err  error
	)
	if starredOnly {
		list, err = f.s.Project.GetStarred()
	} else {
		list, err = f.s.Project.GetAll()
	}
	if err != nil {
		return nil, err
	}
	return ProjectsToSpaces(list), nil
}

func (f *DefaultFacade) GetSpace(id int64) (*Space, error) {
	p, err := f.s.Project.GetByID(id)
	if err != nil {
		return nil, err
	}
	return ProjectToSpace(p), nil
}

func (f *DefaultFacade) SearchSpaces(query string) ([]Space, error) {
	list, err := f.s.Project.Search(query)
	if err != nil {
		return nil, err
	}
	return ProjectsToSpaces(list), nil
}

func (f *DefaultFacade) ToggleSpaceStar(id int64) (bool, error) {
	return f.s.Project.ToggleStar(id)
}

// -- Doc operations -----------------------------------------------------------

func (f *DefaultFacade) ListDocs(spaceID int64) ([]Doc, error) {
	ns, err := f.s.Note.List(spaceID)
	if err != nil {
		return nil, err
	}
	return NotesToDocs(ns), nil
}

func (f *DefaultFacade) ListAllDocs() ([]DocWithSpace, error) {
	list, err := f.s.Note.ListAllWithProject()
	if err != nil {
		return nil, err
	}
	return DocsWithSpaces(list), nil
}

func (f *DefaultFacade) ListAllDocTags() ([]string, error) {
	return f.s.Note.ListAllTags()
}

func (f *DefaultFacade) CreateDoc(spaceID int64, content string) (*Doc, error) {
	n, err := f.s.Note.Create(spaceID, content)
	if err != nil {
		return nil, err
	}
	return NoteToDoc(n), nil
}

func (f *DefaultFacade) CreateDocEx(spaceID int64, title, content, tags, kind, source string) (*Doc, error) {
	n, err := f.s.Note.CreateEx(spaceID, title, content, tags, kind, source)
	if err != nil {
		return nil, err
	}
	return NoteToDoc(n), nil
}

func (f *DefaultFacade) UpdateDoc(id int64, content string) error {
	return f.s.Note.Update(id, content)
}

func (f *DefaultFacade) UpdateDocMeta(id int64, title, tags, kind string, pinned bool) error {
	return f.s.Note.UpdateMeta(id, title, tags, kind, pinned)
}

func (f *DefaultFacade) PinDoc(id int64, pinned bool) error {
	return f.s.Note.Pin(id, pinned)
}

func (f *DefaultFacade) DeleteDoc(id int64) error {
	return f.s.Note.Delete(id)
}

func (f *DefaultFacade) SearchDocs(query string) ([]storage.SearchHit, error) {
	return f.s.Search.Notes(query)
}
