export const DAYS = ['sun', 'mon', 'tue', 'wed', 'thu', 'fri', 'sat'] as const
export const DAY_SHORT = ['S', 'M', 'T', 'W', 'T', 'F', 'S']
export const PARTS = [
  { id: 'am', label: '🌅', from: 6, to: 12 },
  { id: 'pm', label: '☀️', from: 12, to: 17 },
  { id: 'eve', label: '🌙', from: 17, to: 24 },
] as const

export const HOUR = 3600_000
export const DAY = 24 * HOUR

export const dayKey = (d: Date | string) => {
  const x = typeof d === 'string' ? new Date(d) : d
  return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`
}

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate())

export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n)

export function fmtDay(iso: string, now = new Date()) {
  const d = new Date(iso)
  const diff = Math.round((startOfDay(d).getTime() - startOfDay(now).getTime()) / DAY)
  if (diff === 0) return 'Today'
  if (diff === 1) return 'Tomorrow'
  if (diff === -1) return 'Yesterday'
  return d.toLocaleDateString('en-US', { weekday: 'short', month: 'short', day: 'numeric' })
}

function clock(d: Date, withSuffix: boolean) {
  let h = d.getHours()
  const m = d.getMinutes()
  const suffix = h >= 12 ? 'PM' : 'AM'
  h = h % 12 || 12
  return `${h}${m ? ':' + String(m).padStart(2, '0') : ''}${withSuffix ? ' ' + suffix : ''}`
}

export function fmtTimeRange(start: string, end: string) {
  const a = new Date(start)
  const b = new Date(end)
  const same = a.getHours() >= 12 === b.getHours() >= 12
  return `${clock(a, !same)}–${clock(b, true)}`
}

export const fmtTime = (iso: string) => clock(new Date(iso), true)

export const minutes = (start: string, end: string) => Math.round((+new Date(end) - +new Date(start)) / 60000)

export function fmtDuration(start: string, end: string) {
  const m = minutes(start, end)
  if (m < 60) return `${m} min`
  const h = m / 60
  return `${Number.isInteger(h) ? h : h.toFixed(1)} h`
}

export function fmtPay(cents: number) {
  if (cents <= 0) return 'Unpaid'
  const d = cents / 100
  return `$${Number.isInteger(d) ? d : d.toFixed(2)}/h`
}

export function ago(iso: string, now = Date.now()) {
  const s = Math.max(0, (now - +new Date(iso)) / 1000)
  if (s < 60) return 'now'
  if (s < 3600) return `${Math.floor(s / 60)}m`
  if (s < 86400) return `${Math.floor(s / 3600)}h`
  return `${Math.floor(s / 86400)}d`
}

/** Availability slots ("sat-eve") a time range touches. */
export function slotsFor(start: string, end: string) {
  const out = new Set<string>()
  const a = +new Date(start)
  const b = +new Date(end)
  for (let t = a; t < b; t += 30 * 60_000) {
    const d = new Date(t)
    const h = d.getHours()
    const part = PARTS.find((p) => h >= p.from && h < p.to) ?? PARTS[2]
    out.add(`${DAYS[d.getDay()]}-${part.id}`)
  }
  return [...out]
}

/** Local date + "HH:MM" → ISO string. */
export function at(day: Date, hhmm: string) {
  const [h, m] = hhmm.split(':').map(Number)
  return new Date(day.getFullYear(), day.getMonth(), day.getDate(), h, m).toISOString()
}

export const hhmm = (iso: string) => {
  const d = new Date(iso)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
