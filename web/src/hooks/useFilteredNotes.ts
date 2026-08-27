import type { Note } from '../api/client'
import type { KindFilter } from '../types/kind'

/**
 * Pure computed filter — no React state, no side effects.
 * Accepts the full note list and the current filter, returns the subset.
 */
export function useFilteredNotes(notes: Note[], filter: KindFilter): Note[] {
  return notes.filter(n => {
    if (filter === 'knowledge') return n.kind === 'knowledge'
    if (filter === 'other') return n.kind !== 'knowledge'
    return true
  })
}
