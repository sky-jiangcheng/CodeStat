import { describe, expect, it } from 'vitest'
import { daysAgo, getToday, getYesterday, toDateStr } from './dates'

describe('toDateStr', () => {
  it('formats a date as YYYY-MM-DD', () => {
    expect(toDateStr(new Date('2026-08-16T12:00:00Z'))).toBe('2026-08-16')
  })
})

describe('getToday / getYesterday', () => {
  it('yesterday is one day before today', () => {
    const today = new Date(getToday())
    const yesterday = new Date(getYesterday())
    const diffMs = today.getTime() - yesterday.getTime()
    expect(diffMs).toBe(24 * 60 * 60 * 1000)
  })
})

describe('daysAgo', () => {
  it('returns the date N days before today', () => {
    expect(daysAgo(0)).toBe(getToday())
    expect(daysAgo(1)).toBe(getYesterday())
    expect(new Date(daysAgo(7)).getTime()).toBe(new Date(getToday()).getTime() - 7 * 24 * 60 * 60 * 1000)
  })
})
