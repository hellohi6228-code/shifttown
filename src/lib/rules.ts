// Booking, unlock, check-in/out and progression rules.
// The server enforces the same rules in supabase/migrations/0001_init.sql — keep them in sync.
import type { Booking, Opportunity, PostInput, Profile, Quest, Restaurant, Review } from '../types'
import { area, milesBetween } from './geo'
import { fmtTimeRange, HOUR, slotsFor } from './time'

export const ROLES = ['Server', 'Line cook', 'Prep cook', 'Barista', 'Host', 'Cashier', 'Dishwasher', 'Busser', 'Bartender', 'Delivery']

export const ROLE_ICON: Record<string, string> = {
  Server: '🍽️',
  'Line cook': '🔥',
  'Prep cook': '🔪',
  Barista: '☕',
  Host: '🙋',
  Cashier: '💵',
  Dishwasher: '🫧',
  Busser: '🧺',
  Bartender: '🍹',
  Delivery: '🚲',
}

export const SKILLS = ['Food handler', 'ServSafe', 'Alcohol (ATAP)', 'Espresso', 'POS', 'Knife skills', 'Spanish', 'Mandarin', 'Lift 40 lb']

export const title = (o: Opportunity) => (o.kind === 'training' ? 'Training' : o.role)
export const icon = (o: Opportunity) => (o.kind === 'training' ? '🎓' : ROLE_ICON[o.role] ?? '🍳')

export interface Ctx {
  opps: Opportunity[]
  bookings: Booking[]
  quests: Quest[]
}

/** Statuses that hold a spot and the person's time. */
export const holds = (b: Booking) => b.status === 'pending' || b.status === 'confirmed' || b.status === 'checked_in'
const LIVE: Booking['status'][] = ['pending', 'confirmed', 'checked_in', 'done']

export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  +new Date(a.start) < +new Date(b.end) && +new Date(b.start) < +new Date(a.end)

export const oppOf = (ctx: Pick<Ctx, 'opps'>, b: Booking) => ctx.opps.find((o) => o.id === b.oppId)

export const bookingFor = (ctx: Pick<Ctx, 'bookings'>, oppId: string, candidateId: string) =>
  ctx.bookings.find((b) => b.oppId === oppId && b.candidateId === candidateId && LIVE.includes(b.status))

/** A store unlocks (grey → color) once its training is done. */
export const unlocked = (ctx: Ctx, restaurantId: string, candidateId: string) =>
  ctx.bookings.some((b) => b.candidateId === candidateId && b.status === 'done' && (() => {
    const o = oppOf(ctx, b)
    return o?.restaurantId === restaurantId && o.kind === 'training'
  })())

export type Block = { ok: false; code: 'cancelled' | 'started' | 'closed' | 'already' | 'locked' | 'skills' | 'conflict' | 'full'; text: string }
export type Check = { ok: true } | Block

/** Can this candidate request a spot right now? Every request waits for the restaurant to confirm. */
export function check(me: Profile, o: Opportunity, ctx: Ctx, now = Date.now()): Check {
  if (o.cancelled) return { ok: false, code: 'cancelled', text: 'Cancelled' }
  if (now >= +new Date(o.start)) return { ok: false, code: 'started', text: 'Started' }
  if (now > +new Date(o.deadline)) return { ok: false, code: 'closed', text: 'Closed' }
  if (bookingFor(ctx, o.id, me.id)) return { ok: false, code: 'already', text: 'Booked' }
  if (o.kind === 'training' && unlocked(ctx, o.restaurantId, me.id)) return { ok: false, code: 'already', text: 'Done' }
  if (o.kind === 'shift' && !unlocked(ctx, o.restaurantId, me.id)) return { ok: false, code: 'locked', text: '🔒 Training first' }
  const missing = o.skills.filter((s) => !me.skills.includes(s))
  if (missing.length) return { ok: false, code: 'skills', text: `Needs ${missing.join(', ')}` }
  const clash = ctx.bookings.find((b) => b.candidateId === me.id && holds(b) && b.oppId !== o.id && (() => {
    const x = oppOf(ctx, b)
    return x ? overlaps(x, o) : false
  })())
  if (clash) {
    const x = oppOf(ctx, clash)!
    return { ok: false, code: 'conflict', text: `Busy ${fmtTimeRange(x.start, x.end)}` }
  }
  if (o.filled >= o.openings) return { ok: false, code: 'full', text: 'Full' }
  return { ok: true }
}

/** Who is acting on a booking: the candidate, or the restaurant. */
export type By = 'candidate' | 'restaurant'

export const CHECK_IN_EARLY = HOUR

/** Check-in opens an hour before start. The candidate can check in until the end; the restaurant any time after. */
export const canCheckIn = (o: Opportunity, b: Booking, by: By, now = Date.now()) =>
  b.status === 'confirmed' && now >= +new Date(o.start) - CHECK_IN_EARLY && (by === 'restaurant' || now <= +new Date(o.end))

/** The candidate can check out until 12 hours after the end; the restaurant any time. */
export const canCheckOut = (o: Opportunity, b: Booking, by: By, now = Date.now()) =>
  b.status === 'checked_in' && (by === 'restaurant' || now <= +new Date(o.end) + 12 * HOUR)

/** Simple, explainable ranking: fits availability, close by, preferred role, has the skills. */
export function fit(me: Profile, o: Opportunity, r: Restaurant) {
  const need = slotsFor(o.start, o.end)
  let score = need.filter((s) => me.slots.includes(s)).length / Math.max(1, need.length) * 3
  if (milesBetween(area(me.area), r) * 1.3 <= me.radiusMi) score += 2
  if (me.roles.includes(o.role)) score += 2
  if (o.skills.some((s) => !me.skills.includes(s))) score -= 3
  return score
}

/** Experience level — counts finished trainings and shifts. */
const LEVELS = [0, 1, 3, 6, 10, 15, 21, 28, 36, 45, 55]
export function level(n: number) {
  let lv = 1
  LEVELS.forEach((t, i) => {
    if (n >= t) lv = i + 1
  })
  const prev = LEVELS[lv - 1]
  const next = LEVELS[lv] ?? null
  return { lv, n, prev, next, pct: next === null ? 1 : (n - prev) / (next - prev) }
}

export const pointsAt = (ctx: Pick<Ctx, 'quests'>, restaurantId: string, candidateId: string) =>
  ctx.quests.filter((q) => q.restaurantId === restaurantId && q.candidateId === candidateId).length

export function rating(reviews: Review[], candidateId: string) {
  const mine = reviews.filter((r) => r.candidateId === candidateId)
  if (!mine.length) return { avg: null as number | null, count: 0 }
  return { avg: mine.reduce((s, r) => s + r.stars, 0) / mine.length, count: mine.length }
}

export const BADGES = [
  { id: 'trained', icon: '🎓', name: 'Trained', rule: 'Finish 1 training' },
  { id: 'first', icon: '🍳', name: 'First shift', rule: 'Finish 1 shift' },
  { id: 'five', icon: '🖐️', name: 'High five', rule: 'Finish 5 shifts' },
  { id: 'ten', icon: '🏅', name: 'Regular', rule: 'Finish 10 shifts' },
  { id: 'ontime', icon: '⏰', name: 'On time', rule: 'Check in on time 5 times' },
] as const

export function badges(ctx: Ctx, candidateId: string): Set<string> {
  const done = ctx.bookings
    .filter((b) => b.candidateId === candidateId && b.status === 'done')
    .map((b) => ({ b, o: oppOf(ctx, b)! }))
    .filter((x) => x.o)
  const shifts = done.filter((x) => x.o.kind === 'shift').length
  const out = new Set<string>()
  if (done.some((x) => x.o.kind === 'training')) out.add('trained')
  if (shifts >= 1) out.add('first')
  if (shifts >= 5) out.add('five')
  if (shifts >= 10) out.add('ten')
  if (done.filter((x) => x.b.checkInAt && +new Date(x.b.checkInAt) <= +new Date(x.o.start)).length >= 5) out.add('ontime')
  return out
}

export const isOpen = (o: Opportunity, now = Date.now()) =>
  !o.cancelled && +new Date(o.start) > now && +new Date(o.deadline) > now && o.filled < o.openings

/** What a candidate sees for a store on the map. */
export function storeFor(me: Profile, r: Restaurant, ctx: Ctx, now = Date.now()) {
  const open = unlocked(ctx, r.id, me.id)
  const bookable = ctx.opps.some((o) => o.restaurantId === r.id && o.kind === (open ? 'shift' : 'training') && isOpen(o, now) && check(me, o, ctx, now).ok)
  return { unlocked: open, bookable }
}

export function validatePost(p: PostInput, now = Date.now()): string | null {
  const s = +new Date(p.start)
  const e = +new Date(p.end)
  if (!p.role.trim()) return 'Pick a role'
  if (!(e > s)) return 'End must be after start'
  if (s <= now) return 'Pick a future time'
  if (e - s > 12 * HOUR) return 'Max 12 hours'
  if (!(p.openings >= 1 && p.openings <= 50)) return 'Spots 1–50'
  if (!(p.payCents > 0)) return 'Add pay'
  if (+new Date(p.deadline) > s) return 'Deadline must be before start'
  return null
}
