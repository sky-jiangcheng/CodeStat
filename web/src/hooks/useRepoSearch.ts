import { useState, useRef, useEffect, useCallback } from 'react'
import { searchProjects, Project } from '../api/client'

interface RepoSearchState {
  query: string
  results: Project[] | null
  searching: boolean
  containerRef: React.RefObject<HTMLDivElement>
  setQuery: (q: string) => void
  clear: () => void
}

// useRepoSearch provides debounced project/repo search for the Dashboard
// search box. Cross-content search (notes + todos) is handled exclusively by
// the Cmd+K command palette, so this hook only searches repositories.
export function useRepoSearch(): RepoSearchState {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<Project[] | null>(null)
  const [searching, setSearching] = useState(false)
  const debounceRef = useRef<ReturnType<typeof setTimeout>>()
  const containerRef = useRef<HTMLDivElement>(null)

  const clear = useCallback(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current)
    setQuery('')
    setResults(null)
    setSearching(false)
  }, [])

  const setQueryDebounced = useCallback((q: string) => {
    setQuery(q)
    if (debounceRef.current) clearTimeout(debounceRef.current)
    if (!q.trim()) {
      setResults(null)
      setSearching(false)
      return
    }
    setSearching(true)
    debounceRef.current = setTimeout(async () => {
      try {
        const r = await searchProjects(q)
        setResults(r)
      } catch {
        setResults([])
      } finally {
        setSearching(false)
      }
    }, 300)
  }, [])

  // Close dropdown on outside click
  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        clear()
      }
    }
    document.addEventListener('mousedown', handleClick)
    return () => document.removeEventListener('mousedown', handleClick)
  }, [clear])

  // Cleanup debounce timer on unmount
  useEffect(() => {
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current) }
  }, [])

  return { query, results, searching, containerRef, setQuery: setQueryDebounced, clear }
}
