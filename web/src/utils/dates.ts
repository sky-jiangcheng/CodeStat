/** Date helpers shared across pages (YYYY-MM-DD strings). */

export function toDateStr(d: Date): string {
  return d.toISOString().split('T')[0]
}

export function getToday(): string {
  return toDateStr(new Date())
}

export function getYesterday(): string {
  const d = new Date()
  d.setDate(d.getDate() - 1)
  return toDateStr(d)
}

/** The date `days` before today. */
export function daysAgo(days: number): string {
  const d = new Date()
  d.setDate(d.getDate() - days)
  return toDateStr(d)
}
