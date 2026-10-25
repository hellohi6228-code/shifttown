// Booking, eligibility, matching and progression rules.
// The server enforces the same rules in supabase/migrations/0001_init.sql — keep them in sync.
import type { Booking, Eligibility, Kind, Opportunity, PostInput, Profile, Quest, Restaurant, Stage } from '../types'
import { area, milesBetween, travel } from './geo'
import { dayKey, fmtTimeRange, HOUR, slotsFor } from './time'

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
  Any: '✨',
}

export const SKILLS = ['Food handler', 'ServSafe', 'Alcohol (ATAP)', 'Espresso', 'POS', 'Knife skills', 'Spanish', 'Mandarin', 'Lift 40 lb']

export const KIND: Record<Kind, { label: string; icon: string; tone: string }> = {
  intro: { label: 'Intro', icon: '👋', tone: 'sky' },
  training: { label: 'Training', icon: '🎓', tone: 'lav' },
  shift: { label: 'Shift', icon: '🍳', tone: 'mint' },
}

export interface Ctx {
  opps: Opportunity[]
  bookings: Booking[]
  eligibility: Eligibility[]
  quests: Quest[]
}

export const holds = (b: Booking) => b.status === 'pending' || b.status === 'confirmed'

export const overlaps = (a: { start: string; end: string }, b: { start: string; end: string }) =>
  +new Date(a.start) < +new Date(b.end) && +new Date(b.start) < +new Date(a.end)

export const oppOf = (ctx: Pick<Ctx, 'opps'>, b: Booking) => ctx.opps.find((o) => o.id === b.oppId)

export const isEligible = (ctx: Pick<Ctx, 'eligibility'>, restaurantId: string, candidateId: string) =>
  ctx.eligibility.some((e) => e.restaurantId === restaurantId && e.candidateId === candidateId && e.eligible)

const LIVE: Booking['status'][] = ['invited', 'pending', 'confirmed', 'attended', 'no_show']

/** The candidate's current booking for an opportunity, if any. */
export function bookingFor(ctx: Pick<Ctx, 'bookings'>, oppId: string, candidateId: string) {
  return ctx.bookings.find((b) => b.oppId === oppId && b.candidateId === candidateId && LIVE.includes(b.status))
}

export type Block = { ok: false; code: 'cancelled' | 'started' | 'closed' | 'already' | 'locked' | 'skills' | 'conflict' | 'full'; text: string }
export type Check = { ok: true; confirm: boolean } | Block

/** Can this candidate take a spot on this opportunity right now? */
export function check(me: Profile, opp: Opportunity, r: Restaurant | undefined, ctx: Ctx, now = Date.now(), viaInvite = false): Check {
  if (opp.cancelled) return { ok: false, code: 'cancelled', text: 'Cancelled' }
  if (now >= +new Date(opp.start)) return { ok: false, code: 'started', text: 'Started' }
  if (!viaInvite && now > +new Date(opp.deadline)) return { ok: false, code: 'closed', text: 'Closed' }
  const existing = bookingFor(ctx, opp.id, me.id)
  if (existing && (!viaInvite || existing.status !== 'invited')) return { ok: false, code: 'already', text: 'Booked' }
  if (opp.kind === 'shift' && !isEligible(ctx, opp.restaurantId, me.id)) return { ok: false, code: 'locked', text: 'Intro first' }
  const missing = opp.skills.filter((s) => !me.skills.includes(s))
  if (missing.length) return { ok: false, code: 'skills', text: `Needs ${missing.join(', ')}` }
  const clash = ctx.bookings.find((b) => b.candidateId === me.id && holds(b) && b.oppId !== opp.id && (() => {
    const o = oppOf(ctx, b)
    return o ? overlaps(o, opp) : false
  })())
  if (clash) {
    const o = oppOf(ctx, clash)!
    return { ok: false, code: 'conflict', text: `Clashes ${fmtTimeRange(o.start, o.end)}` }
  }
  if (opp.filled >= opp.openings) return { ok: false, code: 'full', text: 'Full' }
  return { ok: true, confirm: viaInvite || !!r?.autoConfirm }
}

export interface Reason {
  ok: boolean
  text: string
}

/** Rule-based, explainable matching. Uses only time, distance, role and stated skills —
 *  never school, neighborhood quality, nationality or other proxies. */
export function match(me: Profile, opp: Opportunity, r: Restaurant, ctx: Ctx): { score: number; reasons: Reason[] } {
  const reasons: Reason[] = []
  let score = 0

  const need = slotsFor(opp.start, opp.end)
  const have = need.filter((s) => me.slots.includes(s)).length
  if (have === need.length) {
    reasons.push({ ok: true, text: 'Fits your time' })
    score += 3
  } else if (have > 0) {
    reasons.push({ ok: false, text: 'Partly your time' })
    score += 1
  } else reasons.push({ ok: false, text: 'Outside your hours' })

  const t = travel(milesBetween(area(me.area), r))
  if (t.mi <= me.radiusMi) {
    reasons.push({ ok: true, text: `${t.icon} ${t.mins} min` })
    score += 2
  } else reasons.push({ ok: false, text: `${t.mi.toFixed(1)} mi away` })

  if (opp.role !== 'Any') {
    if (me.roles.includes(opp.role)) {
      reasons.push({ ok: true, text: 'Your role' })
      score += 2
    }
  }

  const missing = opp.skills.filter((s) => !me.skills.includes(s))
  if (missing.length) {
    reasons.push({ ok: false, text: `Needs ${missing[0]}` })
    score -= 3
  } else if (opp.skills.length) {
    reasons.push({ ok: true, text: 'Has skills' })
    score += 2
  }

  const clash = ctx.bookings.some((b) => b.candidateId === me.id && holds(b) && b.oppId !== opp.id && (() => {
    const o = oppOf(ctx, b)
    return o ? overlaps(o, opp) : false
  })())
  if (clash) {
    reasons.push({ ok: false, text: 'Clashes' })
    score -= 10
  }
  return { score, reasons }
}

export function stage(ctx: Ctx, restaurantId: string, candidateId: string): Stage {
  const mine = ctx.bookings
    .filter((b) => b.candidateId === candidateId)
    .map((b) => ({ b, o: oppOf(ctx, b) }))
    .filter((x) => x.o?.restaurantId === restaurantId)
  const eligible = isEligible(ctx, restaurantId, candidateId)
  if (eligible && mine.some((x) => x.b.status === 'attended' && x.o!.kind === 'shift')) return 'active'
  if (eligible) return 'eligible'
  if (mine.some((x) => x.b.status === 'attended' && x.o!.kind !== 'shift')) return 'completed'
  if (mine.some((x) => holds(x.b) && x.o!.kind !== 'shift')) return 'booked'
  return 'new'
}

export const STAGES: { id: Stage; icon: string; label: string }[] = [
  { id: 'new', icon: '🌱', label: 'New' },
  { id: 'booked', icon: '📅', label: 'Booked' },
  { id: 'completed', icon: '✅', label: 'Met' },
  { id: 'eligible', icon: '🔓', label: 'Eligible' },
  { id: 'active', icon: '⭐', label: 'Active' },
]

export const pointsAt = (ctx: Pick<Ctx, 'quests'>, restaurantId: string, candidateId: string) =>
  ctx.quests.filter((q) => q.restaurantId === restaurantId && q.candidateId === candidateId).length

/** Experience level — counts finished quests. It is not a performance rating. */
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

export const BADGES = [
  { id: 'hello', icon: '👋', name: 'Hello!', rule: 'Finish 1 intro or training' },
  { id: 'first', icon: '🍳', name: 'First shift', rule: 'Finish 1 paid shift' },
  { id: 'five', icon: '🖐️', name: 'High five', rule: 'Finish 5 paid shifts' },
  { id: 'ten', icon: '🏅', name: 'Regular', rule: 'Finish 10 paid shifts' },
  { id: 'steady', icon: '🛡️', name: 'Steady', rule: '5 shifts in a row, no no-shows' },
  { id: 'local', icon: '🏡', name: 'Local fave', rule: '3 quests at one place' },
  { id: 'explorer', icon: '🧭', name: 'Explorer', rule: 'Quests at 3 places' },
] as const

export function badges(ctx: Ctx, candidateId: string): Set<string> {
  const done = ctx.bookings
    .filter((b) => b.candidateId === candidateId && (b.status === 'attended' || b.status === 'no_show'))
    .map((b) => ({ b, o: oppOf(ctx, b)! }))
    .filter((x) => x.o)
    .sort((a, b) => +new Date(a.o.start) - +new Date(b.o.start))
  const shifts = done.filter((x) => x.o.kind === 'shift')
  const attendedShifts = shifts.filter((x) => x.b.status === 'attended').length
  const out = new Set<string>()
  if (done.some((x) => x.o.kind !== 'shift' && x.b.status === 'attended')) out.add('hello')
  if (attendedShifts >= 1) out.add('first')
  if (attendedShifts >= 5) out.add('five')
  if (attendedShifts >= 10) out.add('ten')
  let run = 0
  for (const x of shifts) {
    run = x.b.status === 'attended' ? run + 1 : 0
    if (run >= 5) out.add('steady')
  }
  const byPlace = new Map<string, number>()
  ctx.quests.filter((q) => q.candidateId === candidateId).forEach((q) => byPlace.set(q.restaurantId, (byPlace.get(q.restaurantId) ?? 0) + 1))
  if ([...byPlace.values()].some((n) => n >= 3)) out.add('local')
  if (byPlace.size >= 3) out.add('explorer')
  return out
}

export const isOpen = (o: Opportunity, now = Date.now()) =>
  !o.cancelled && +new Date(o.start) > now && +new Date(o.deadline) > now && o.filled < o.openings

export const isNew = (o: Opportunity, now = Date.now()) => now - +new Date(o.createdAt) < 48 * HOUR

export function restaurantState(r: Restaurant, opps: Opportunity[], now = Date.now()): 'new' | 'hiring' | 'none' {
  const open = opps.filter((o) => o.restaurantId === r.id && isOpen(o, now))
  if (!open.length) return 'none'
  return open.some((o) => isNew(o, now)) ? 'new' : 'hiring'
}

/** Attendance can be recorded from the day of the activity onward. */
export const canRecord = (o: Opportunity, now = new Date()) => dayKey(now) >= dayKey(o.start)

export function validatePost(p: PostInput, now = Date.now()): string | null {
  const s = +new Date(p.start)
  const e = +new Date(p.end)
  if (!p.role.trim()) return 'Pick a role'
  if (!(e > s)) return 'End must be after start'
  if (s <= now) return 'Pick a future time'
  if (e - s > 12 * HOUR) return 'Max 12 hours'
  if (!(p.openings >= 1 && p.openings <= 50)) return 'Openings 1–50'
  if (p.payCents < 0) return 'Check pay'
  if (p.kind !== 'intro' && p.payCents <= 0) return 'Training and shifts are paid'
  if (+new Date(p.deadline) > s) return 'Deadline must be before start'
  return null
}
