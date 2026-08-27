import { renderHook, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'

vi.mock('../api/client', () => ({
  getScanStatus: vi.fn(),
}))

vi.mock('react-i18next', () => ({
  useTranslation: () => ({ t: (_key: string, opts?: { defaultValue?: string }) => opts?.defaultValue ?? _key }),
}))

import { useScanPolling } from './useScanPolling'
import { getScanStatus } from '../api/client'

const mockGetScanStatus = vi.mocked(getScanStatus)

const idle = { running: false, backfilling: false, message: '', progress: 0, total: 0 }
const running = (msg: string) => ({ running: true, backfilling: false, message: msg, progress: 1, total: 3 })

describe('useScanPolling', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    mockGetScanStatus.mockReset()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('starts with scanning=false', () => {
    mockGetScanStatus.mockResolvedValue(idle)
    const { result } = renderHook(() => useScanPolling(() => {}))
    expect(result.current.scanning).toBe(false)
    expect(result.current.message).toBe('')
  })

  it('start() sets scanning=true and begins polling', () => {
    mockGetScanStatus.mockResolvedValue(idle)
    const { result } = renderHook(() => useScanPolling(() => {}))

    act(() => { result.current.start('Scanning…') })

    expect(result.current.scanning).toBe(true)
    expect(result.current.message).toBe('Scanning…')
    expect(result.current.doneMessage).toBe('')
  })

  it('calls onFinish when scan completes', async () => {
    const onFinish = vi.fn()
    mockGetScanStatus
      .mockResolvedValueOnce(running('in progress'))
      .mockResolvedValueOnce(idle)

    const { result } = renderHook(() => useScanPolling(onFinish))

    act(() => { result.current.start('Scanning…') })

    await act(async () => { await vi.advanceTimersByTimeAsync(2100) })

    expect(result.current.scanning).toBe(false)
    expect(onFinish).toHaveBeenCalledTimes(1)
  })

  it('auto-detects an already-running scan on mount', async () => {
    mockGetScanStatus.mockResolvedValue(running('already running'))

    const { result } = renderHook(() => useScanPolling(() => {}))

    await act(async () => { await vi.advanceTimersByTimeAsync(0) })

    expect(result.current.scanning).toBe(true)
    expect(result.current.message).toBe('already running')
  })
})
