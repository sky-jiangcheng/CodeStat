import { useState, useEffect, useCallback, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import {
  listNotes, createNoteWithMeta, updateNoteFull, deleteNote, pinNote, moveNote,
  listNoteVersions, restoreNoteVersion, diffNoteVersions, getProjects,
  type Note, type NoteVersion, type Project,
} from '../api/client'
import { renderMarkdown } from '../utils/markdown'
import NoteEditor, { type NoteDraft } from './notes/NoteEditor'
import VersionHistoryPanel from './notes/VersionHistoryPanel'
import ErrorBanner from './ErrorBanner'
import { useConfirmClick } from '../hooks/useConfirmClick'
import { useApiData } from '../hooks/useApiData'

interface Props {
  projectId: number
  autoNew?: boolean
}

type KindFilter = 'all' | 'knowledge' | 'other'

function draftKey(projectId: number) {
  return `gitbuddy-note-draft-${projectId}`
}

function legacyDraftKey(projectId: number) {
  return `gitboard-note-draft-${projectId}`
}

const emptyDraft: NoteDraft = { content: '', title: '', tags: '', kind: 'knowledge' }

function loadDraft(projectId: number): NoteDraft {
  try {
    let raw = localStorage.getItem(draftKey(projectId))
    if (!raw) {
      raw = localStorage.getItem(legacyDraftKey(projectId))
      if (raw) {
        localStorage.setItem(draftKey(projectId), raw)
        localStorage.removeItem(legacyDraftKey(projectId))
      }
    }
    if (raw) {
      const parsed = JSON.parse(raw)
      // Validate structure — discard if shape doesn't match NoteDraft
      if (
        typeof parsed === 'object' && parsed !== null &&
        typeof parsed.content === 'string' &&
        typeof parsed.title === 'string' &&
        typeof parsed.tags === 'string' &&
        typeof parsed.kind === 'string'
      ) {
        return {
          content: parsed.content,
          title: parsed.title,
          tags: parsed.tags,
          kind: parsed.kind,
          pinned: typeof parsed.pinned === 'boolean' ? parsed.pinned : undefined,
        }
      }
    }
  } catch { /* ignore */ }
  return { ...emptyDraft }
}

function NoteSection({ projectId, autoNew = false }: Props) {
  const { t } = useTranslation()
  const [notes, setNotes] = useState<Note[]>([])
  const [loading, setLoading] = useState(true)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editDraft, setEditDraft] = useState<NoteDraft>({ ...emptyDraft })
  const [isNew, setIsNew] = useState(false)
  const [saving, setSaving] = useState(false)
  const [filter, setFilter] = useState<KindFilter>('all')

  const [draft, setDraft] = useState<NoteDraft>(() => loadDraft(projectId))
  // The move-to-project dropdown reuses the shared "all projects" list, cached
  // and deduped across components via useApiData (same key as CommandPalette).
  const { data: projectsData } = useApiData(() => getProjects(undefined, false), [], { cacheKey: 'projects:all' })
  const projects = projectsData ?? []
  const [versionHistory, setVersionHistory] = useState<NoteVersion[] | null>(null)
  const [currentNoteId, setCurrentNoteId] = useState<number | null>(null)
  const [restoringId, setRestoringId] = useState<number | null>(null)
  const [diffText, setDiffText] = useState<string | null>(null)
  const [error, setError] = useState('')
  // The last failed mutation, replayed by the ErrorBanner retry button so a
  // failed create/save/delete/etc. is recoverable instead of silently dead.
  const lastOpRef = useRef<(() => Promise<void>) | null>(null)

  // run wraps a mutation with the same error path every handler used to
  // swallow with `/* ignore */`. On failure it stores the error message and
  // the op so the banner's retry can replay it.
  const run = useCallback(async (op: () => Promise<void>, errMsg: string) => {
    setError('')
    try {
      await op()
    } catch (e) {
      lastOpRef.current = op
      setError(errMsg + (e instanceof Error ? e.message : t('common.unknownError')))
    }
  }, [t])

  const fetchNotes = useCallback(() => {
    listNotes(projectId).then(setNotes).finally(() => setLoading(false))
  }, [projectId])

  useEffect(() => { fetchNotes() }, [fetchNotes])

  useEffect(() => {
    if (autoNew) {
      setIsNew(true) // eslint-disable-line react-hooks/set-state-in-effect
      setEditingId(null)
    }
  }, [autoNew])

  useEffect(() => {
    try { localStorage.setItem(draftKey(projectId), JSON.stringify(draft)) } catch { /* ignore */ }
  }, [draft, projectId])

  const startNew = () => {
    setIsNew(true)
    setEditingId(null)
  }

  const handleCreate = async () => {
    if (!draft.content.trim()) return
    setSaving(true)
    await run(async () => {
      await createNoteWithMeta(projectId, draft.content.trim(), {
        title: draft.title.trim(),
        tags: draft.tags.trim(),
        kind: draft.kind,
      })
      setDraft({ ...emptyDraft })
      try { localStorage.removeItem(draftKey(projectId)) } catch { /* ignore */ }
      setIsNew(false)
      fetchNotes()
    }, t('project.saveFailed') + ': ')
    setSaving(false)
  }

  const startEdit = (note: Note) => {
    setEditingId(note.id)
    setEditDraft({
      content: note.content,
      title: note.title,
      tags: note.tags,
      kind: note.kind || 'other',
      pinned: note.pinned,
    })
    setIsNew(false)
  }

  const handleSaveEdit = async () => {
    if (editingId === null || !editDraft.content.trim()) return
    setSaving(true)
    await run(async () => {
      await updateNoteFull(
        editingId,
        editDraft.content.trim(),
        editDraft.title.trim(),
        editDraft.tags.trim(),
        editDraft.kind,
        !!editDraft.pinned
      )
      setEditingId(null)
      fetchNotes()
    }, t('project.saveFailed') + ': ')
    setSaving(false)
  }

  const handleMoveProject = async (noteId: number, targetProjectId: number) => {
    if (targetProjectId === projectId) return
    await run(async () => {
      await moveNote(noteId, targetProjectId)
      setNotes(prev => prev.filter(n => n.id !== noteId))
      if (editingId === noteId) setEditingId(null)
    }, t('project.saveFailed') + ': ')
  }

  const handleDelete = async (noteId: number) => {
    await run(async () => {
      await deleteNote(noteId)
      setNotes(prev => prev.filter(n => n.id !== noteId))
    }, t('project.saveFailed') + ': ')
  }

  const handlePin = async (note: Note) => {
    const nextPinned = !note.pinned
    setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: nextPinned } : n))
    await run(async () => {
      await pinNote(note.id, nextPinned)
    }, t('project.saveFailed') + ': ')
    // Roll back the optimistic toggle if the pin actually failed.
    if (lastOpRef.current) setNotes(prev => prev.map(n => n.id === note.id ? { ...n, pinned: note.pinned } : n))
  }

  const openVersionHistory = async (noteId: number) => {
    if (currentNoteId === noteId && versionHistory !== null) {
      setVersionHistory(null)
      setCurrentNoteId(null)
      setDiffText(null)
      return
    }
    setCurrentNoteId(noteId)
    setVersionHistory(null)
    setDiffText(null)
    await run(async () => {
      setVersionHistory(await listNoteVersions(noteId))
    }, t('project.saveFailed') + ': ')
  }

  const handleRestoreVersion = async (versionId: number) => {
    if (currentNoteId === null) return
    setRestoringId(versionId)
    await run(async () => {
      await restoreNoteVersion(currentNoteId, versionId)
      setVersionHistory(null)
      setCurrentNoteId(null)
      fetchNotes()
    }, t('project.saveFailed') + ': ')
    setRestoringId(null)
  }

  const handleShowDiff = async (versionId: number) => {
    if (currentNoteId === null) return
    if (diffText !== null && diffText.startsWith(`${currentNoteId}-${versionId}`)) {
      setDiffText(null)
      return
    }
    await run(async () => {
      const diff = await diffNoteVersions(currentNoteId, versionId)
      setDiffText(`${currentNoteId}-${versionId}\n${diff}`)
    }, t('project.saveFailed') + ': ')
  }

  // Retry replays the last failed mutation captured by `run`.
  const retryLast = () => {
    const op = lastOpRef.current
    if (op) { lastOpRef.current = null; void op() }
  }

  const filteredNotes = notes.filter(n => {
    if (filter === 'knowledge') return n.kind === 'knowledge'
    if (filter === 'other') return n.kind !== 'knowledge'
    return true
  })

  if (loading) {
    return (
      <div className="panel-section">
        <h3>{t('knowledge.notesTitle', { defaultValue: '知识笔记' })}</h3>
        <div className="skeleton skeleton-text" style={{ height: 60, marginBottom: 8 }} />
        <div className="skeleton skeleton-text" style={{ height: 60 }} />
      </div>
    )
  }

  return (
    <div className="panel-section">
      <div className="note-header">
        <h3>{t('knowledge.notesTitle', { defaultValue: '知识笔记' })} ({notes.length})</h3>
        {!isNew && editingId === null && (
          <button className="btn btn-sm btn-primary" onClick={startNew}>{t('project.createNote')}</button>
        )}
      </div>

      {error && (
        <ErrorBanner message={error} onRetry={retryLast} />
      )}

      {notes.length > 0 && (
        <div className="note-filters">
          <button className={`filter-btn ${filter === 'all' ? 'active' : ''}`} onClick={() => setFilter('all')}>{t('project.filterAll')}</button>
          <button className={`filter-btn ${filter === 'knowledge' ? 'active' : ''}`} onClick={() => setFilter('knowledge')}>{t('project.kinds.knowledge')}</button>
          <button className={`filter-btn ${filter === 'other' ? 'active' : ''}`} onClick={() => setFilter('other')}>{t('project.kinds.other')}</button>
        </div>
      )}

      {isNew && (
        <NoteEditor
          value={draft}
          onChange={setDraft}
          onSave={handleCreate}
          onCancel={() => { setIsNew(false); setDraft({ ...emptyDraft }) }}
          saving={saving}
        />
      )}

      {filteredNotes.length === 0 && !isNew ? (
        <p className="empty-hint">{filter !== 'all' ? t('knowledge.noMatch') : t('project.noNotesHint')}</p>
      ) : (
        <div className="note-list">
          {filteredNotes.map(note => (
            <NoteCard
              key={note.id}
              note={note}
              editing={editingId === note.id}
              editDraft={editDraft}
              onEditDraftChange={setEditDraft}
              onSaveEdit={handleSaveEdit}
              onCancelEdit={() => setEditingId(null)}
              saving={saving}
              projects={projects}
              currentProjectId={projectId}
              onMoveProject={handleMoveProject}
              onPin={handlePin}
              onEdit={startEdit}
              onOpenHistory={openVersionHistory}
              onDelete={handleDelete}
            />
          ))}
        </div>
      )}

      {versionHistory !== null && (
        <VersionHistoryPanel
          versions={versionHistory}
          restoringId={restoringId}
          diffText={diffText}
          onRestore={handleRestoreVersion}
          onShowDiff={handleShowDiff}
          onClose={() => { setVersionHistory(null); setCurrentNoteId(null); setDiffText(null) }}
        />
      )}
    </div>
  )
}

/** NoteCard renders one note, switching to the inline editor when editing. */
function NoteCard({
  note, editing, editDraft, onEditDraftChange, onSaveEdit, onCancelEdit, saving,
  projects, currentProjectId, onMoveProject, onPin, onEdit, onOpenHistory, onDelete,
}: {
  note: Note
  editing: boolean
  editDraft: NoteDraft
  onEditDraftChange: (d: NoteDraft) => void
  onSaveEdit: () => void
  onCancelEdit: () => void
  saving: boolean
  projects: Project[]
  currentProjectId: number
  onMoveProject: (noteId: number, projectId: number) => void
  onPin: (note: Note) => void
  onEdit: (note: Note) => void
  onOpenHistory: (noteId: number) => void
  onDelete: (noteId: number) => void
}) {
  const { t } = useTranslation()
  const { armed, click } = useConfirmClick(() => { void onDelete(note.id) })

  if (editing) {
    return (
      <div className="note-card">
        <NoteEditor
          value={editDraft}
          onChange={onEditDraftChange}
          onSave={onSaveEdit}
          onCancel={onCancelEdit}
          saving={saving}
          showPinned
          projects={projects}
          currentProjectId={currentProjectId}
          onMoveProject={(pid) => onMoveProject(note.id, pid)}
        />
      </div>
    )
  }

  return (
    <div className={`note-card ${note.pinned ? 'pinned' : ''}`}>
      <div className="note-title-row">
        <span className="note-title-text">{note.title || note.content.split('\n')[0] || t('project.noteWord')}</span>
        <div className="note-title-badges">
          {note.kind === 'knowledge' && <span className="badge-note-sm">{t('project.kinds.knowledge')}</span>}
          {note.source === 'claude' && <span className="badge-note-sm badge-source">Claude</span>}
          <button
            className={`pin-btn ${note.pinned ? 'pinned' : ''}`}
            onClick={() => onPin(note)}
            title={note.pinned ? t('project.unpinned') : t('project.pinned')}
          >★</button>
        </div>
      </div>
      <div className="note-body markdown-body" dangerouslySetInnerHTML={{ __html: renderMarkdown(note.content) }} />
      {note.tags && (
        <div className="note-tags-row">
          {note.tags.split(',').map(t => t.trim()).filter(Boolean).map(t => <span key={t} className="note-tag-chip">#{t}</span>)}
        </div>
      )}
      <div className="note-meta">
        <span className="note-time">
          {note.updated_at !== note.created_at
            ? `${t('project.updatedAtPrefix')} ${note.updated_at}`
            : `${t('project.createdAtPrefix')} ${note.created_at}`}
        </span>
        <div className="note-actions">
          <button className="btn btn-sm" onClick={() => onEdit(note)}>{t('project.edit')}</button>
          <button
            className="btn btn-sm"
            onClick={() => onOpenHistory(note.id)}
            title={t('project.versionHistory')}
          >
            {t('project.history')}
          </button>
          <button
            className={`btn btn-sm ${armed ? 'btn-delete-confirm' : 'btn-danger'}`}
            onClick={click}
          >
            {armed ? t('project.confirmDelete') : t('common.delete')}
          </button>
        </div>
      </div>
    </div>
  )
}

export default NoteSection
