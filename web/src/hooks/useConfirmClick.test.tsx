// @vitest-environment jsdom
import { describe, expect, it, vi } from 'vitest'
import { act, renderHook } from '@testing-library/react'
import { useConfirmClick } from './useConfirmClick'

describe('useConfirmClick', () => {
  it('starts disarmed and does not fire on the first click', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useConfirmClick(onConfirm))
    expect(result.current.armed).toBe(false)

    act(() => { result.current.click() })
    expect(result.current.armed).toBe(true)
    expect(onConfirm).not.toHaveBeenCalled()
  })

  it('fires onConfirm on the second click and re-arms off', () => {
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useConfirmClick(onConfirm))

    act(() => { result.current.click() })
    act(() => { result.current.click() })

    expect(onConfirm).toHaveBeenCalledTimes(1)
    expect(result.current.armed).toBe(false)
  })

  it('auto-disarms after resetMs without firing', () => {
    vi.useFakeTimers()
    const onConfirm = vi.fn()
    const { result } = renderHook(() => useConfirmClick(onConfirm, 1000))

    act(() => { result.current.click() })
    expect(result.current.armed).toBe(true)

    act(() => { vi.advanceTimersByTime(1000) })
    expect(result.current.armed).toBe(false)
    expect(onConfirm).not.toHaveBeenCalled()
    vi.useRealTimers()
  })

  it('reads the latest onConfirm via a ref', () => {
    const first = vi.fn()
    const second = vi.fn()
    const { result, rerender } = renderHook(({ fn }) => useConfirmClick(fn), { initialProps: { fn: first } })

    rerender({ fn: second })
    act(() => { result.current.click() })
    act(() => { result.current.click() })

    expect(first).not.toHaveBeenCalled()
    expect(second).toHaveBeenCalledTimes(1)
  })
})
