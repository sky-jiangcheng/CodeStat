// @vitest-environment jsdom
import { describe, expect, it, vi, beforeEach } from 'vitest'

const callMock = vi.fn()
vi.mock('./transport', () => ({ call: (...args: unknown[]) => callMock(...args) }))

import { searchAll, searchNotes, getProjects, toggleStar, getProjectDetail } from './endpoints'

beforeEach(() => {
  callMock.mockReset()
  callMock.mockResolvedValue([])
})

describe('endpoint routing contract', () => {
  it('searchAll routes to the SearchAll binding and the /search path', async () => {
    await searchAll('登录 排查')
    expect(callMock).toHaveBeenCalledWith({
      method: 'SearchAll',
      args: ['登录 排查'],
      path: '/search?q=%E7%99%BB%E5%BD%95%20%E6%8E%92%E6%9F%A5',
    })
  })

  it('searchNotes routes to the SearchNotes binding', async () => {
    await searchNotes('fts query')
    expect(callMock).toHaveBeenCalledWith({
      method: 'SearchNotes',
      args: ['fts query'],
      path: '/notes/search?q=fts%20query',
    })
  })

  it('getProjects encodes date and starred params into the query string', async () => {
    await getProjects('2026-08-01', true)
    expect(callMock).toHaveBeenCalledWith({
      method: 'GetProjects',
      args: ['2026-08-01', true],
      path: '/projects?date=2026-08-01&starred=1',
    })
  })

  it('toggleStar POSTs to the star path and unwraps a bare boolean', async () => {
    callMock.mockResolvedValueOnce(true)
    const starred = await toggleStar(7)
    expect(callMock).toHaveBeenCalledWith({
      method: 'ToggleStar',
      args: [7],
      path: '/projects/7/star',
      init: { method: 'POST' },
    })
    expect(starred).toBe(true)
  })

  it('getProjectDetail routes to the detail path with the project id', async () => {
    callMock.mockResolvedValueOnce({ id: 3 })
    await getProjectDetail(3)
    expect(callMock).toHaveBeenCalledWith({
      method: 'GetProjectDetail',
      args: [3],
      path: '/projects/3',
    })
  })
})