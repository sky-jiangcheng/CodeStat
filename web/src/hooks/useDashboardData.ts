import { useState, useEffect, useRef, useCallback } from 'react'
import {
  getProjects, getSummary, getTodoCounts, getNoteCounts, getConfig,
  triggerScan, getScanStatus, toggleStar, refreshProjectHistory,
  Project, Summary, TodoCount, NoteCount,
} from '../api/client'

function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return d.toISOString().split('T')[0]
}

export type SortKey = 'name' | 'my_added' | 'my_files' | 'repo_count'

export const SORT_OPTIONS: { key: SortKey; label: string }[] = [
  { key: 'name', label: '名称' },
  { key: 'my_added', label: '新增行数' },
  { key: 'my_files', label: '文件变更' },
  { key: 'repo_count', label: '仓库数' },
]

export interface DashboardData {
  projects: Project[]
  summary: Summary | null
  todoCounts: TodoCount[]
  noteCounts: NoteCount[]
  dailyGoal: number
  loading: boolean
  scanning: boolean
  scanMsg: string
  error: string
  date: string
  showStarredOnly: boolean
  sortKey: SortKey
  setDate: (d: string) => void
  setShowStarredOnly: (v: boolean) => void
  setSortKey: (k: SortKey) => void
  handleScan: () => void
  handleToggleStar: (projectId: number) => Promise<void>
  handleRefreshHistory: (projectId: number) => Promise<void>
  retry: () => void
}

// useDashboardData encapsulates all data fetching, scan polling, and mutation
// handlers for the Dashboard page. Extracting this keeps the Dashboard
// component focused on layout and rendering.
export function useDashboardData(): DashboardData {
  const [projects, setProjects] = useState<Project[]>([])
  const [summary, setSummary] = useState<Summary | null>(null)
  const [dailyGoal, setDailyGoal] = useState(500)
  const [date, setDate] = useState(getYesterday())
  const [loading, setLoading] = useState(true)
  const [scanning, setScanning] = useState(false)
  const [scanMsg, setScanMsg] = useState('')
  const [error, setError] = useState('')
  const [sortKey, setSortKey] = useState<SortKey>('my_added')
  const [todoCounts, setTodoCounts] = useState<TodoCount[]>([])
  const [noteCounts, setNoteCounts] = useState<NoteCount[]>([])
  const [showStarredOnly, setShowStarredOnly] = useState(true)
  const pollTimer = useRef<number | null>(null)

  const fetchData = useCallback(async (selectedDate: string, starredOnly: boolean) => {
    setLoading(true)
    setError('')
    try {
      const [projData, sumData, counts, noteCountsData] = await Promise.all([
        getProjects(selectedDate, starredOnly),
        getSummary(selectedDate),
        getTodoCounts(),
        getNoteCounts(),
      ])
      setProjects(projData)
      setSummary(sumData)
      setTodoCounts(counts)
      setNoteCounts(noteCountsData)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '加载失败')
    } finally {
      setLoading(false)
    }
  }, [])

  const checkScanStatus = useCallback(async (selectedDate: string, starredOnly: boolean) => {
    try {
      const status = await getScanStatus()
      if (status.running || status.backfilling) {
        setScanning(true)
        setScanMsg(status.message)
        if (!pollTimer.current) {
          pollTimer.current = window.setInterval(async () => {
            const s = await getScanStatus()
            if (!s.running && !s.backfilling) {
              if (pollTimer.current) clearInterval(pollTimer.current)
              pollTimer.current = null
              setScanning(false)
              setScanMsg('')
              fetchData(selectedDate, starredOnly)
            } else {
              setScanMsg(s.message)
            }
          }, 2000)
        }
      }
    } catch { /* ignore */ }
  }, [fetchData])

  useEffect(() => {
    getConfig()
      .then(c => {
        const v = parseInt(c.config.daily_code_standards || '500', 10)
        if (!isNaN(v) && v > 0) setDailyGoal(v)
      })
      .catch(() => {})
    fetchData(date, showStarredOnly)
    checkScanStatus(date, showStarredOnly)
    return () => { if (pollTimer.current) clearInterval(pollTimer.current) }
  }, [date, showStarredOnly, fetchData, checkScanStatus])

  const handleScan = useCallback(async () => {
    setError('')
    try {
      await triggerScan()
      setScanning(true)
      setScanMsg('正在扫描仓库…')
      if (pollTimer.current) clearInterval(pollTimer.current)
      pollTimer.current = window.setInterval(async () => {
        const s = await getScanStatus()
        if (!s.running && !s.backfilling) {
          if (pollTimer.current) clearInterval(pollTimer.current)
          pollTimer.current = null
          setScanning(false)
          setScanMsg('')
          fetchData(date, showStarredOnly)
        } else {
          setScanMsg(s.message)
        }
      }, 2000)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '扫描失败')
    }
  }, [date, showStarredOnly, fetchData])

  const handleToggleStar = useCallback(async (projectId: number) => {
    try {
      const newStarred = await toggleStar(projectId)
      setProjects(prev => prev.map(p => p.id === projectId ? { ...p, is_starred: newStarred } : p))
      if (showStarredOnly && !newStarred) {
        setProjects(prev => prev.filter(p => p.id !== projectId))
      }
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '操作失败')
    }
  }, [showStarredOnly])

  const handleRefreshHistory = useCallback(async (projectId: number) => {
    try {
      await refreshProjectHistory(projectId)
      await fetchData(date, showStarredOnly)
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : '刷新历史记录失败')
    }
  }, [date, showStarredOnly, fetchData])

  const retry = useCallback(() => fetchData(date, showStarredOnly), [fetchData, date, showStarredOnly])

  return {
    projects, summary, todoCounts, noteCounts, dailyGoal,
    loading, scanning, scanMsg, error,
    date, showStarredOnly, sortKey,
    setDate, setShowStarredOnly, setSortKey,
    handleScan, handleToggleStar, handleRefreshHistory, retry,
  }
}
