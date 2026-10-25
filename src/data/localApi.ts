// Demo backend: same rules as the Postgres functions, stored in localStorage.
import type { Booking, Note, NoteKind, Opportunity, PostInput, ProfileInput, RegisterInput, Snapshot } from '../types'
import { inBounds, parseMapsUrl } from '../lib/geo'
import { canRecord, check, holds, validatePost } from '../lib/rules'
import { DAY, fmtDay, fmtTime } from '../lib/time'
import { fail, type Api, type Identity } from './api'
import { DB_VERSION, seed, type DB } from './demo'

const KEY = 'st.db'
const UID = 'st.uid'
const SELF = 'st.self'
const PALETTE = ['#FF8FB1', '#6EC6FF', '#FFD25A', '#5CC49E', '#B79CFF', '#FFB38A', '#7FD3E8', '#A8E07A']

const store = {
  get(k: string) {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set(k: string, v: string) {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* private mode: keep in memory only */
    }
  },
}

const rid = (p: string) => `${p}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`
const now = () => new Date().toISOString()

export class LocalApi implements Api {
  mode = 'demo' as const
  private db: DB
  private uid: string | null = store.get(UID)

  constructor() {
    const raw = store.get(KEY)
    let db: DB | null = null
    try {
      db = raw ? (JSON.parse(raw) as DB) : null
    } catch {
      db = null
    }
    this.db = db && db.v === DB_VERSION ? db : seed()
    this.save()
  }

  /** Another tab may have written since we last looked — always start from storage. */
  private sync() {
    try {
      const raw = store.get(KEY)
      const db = raw ? (JSON.parse(raw) as DB) : null
      if (db && db.v === DB_VERSION) this.db = db
    } catch {
      /* keep what we have */
    }
  }

  private save() {
    store.set(KEY, JSON.stringify(this.db))
  }

  private me() {
    return this.db.profiles.find((p) => p.id === this.uid) ?? fail('Finish your profile first')
  }

  private opp(id: string) {
    return this.db.opps.find((o) => o.id === id) ?? fail('Not found')
  }

  private place(id: string) {
    return this.db.restaurants.find((r) => r.id === id) ?? fail('Not found')
  }

  private isMember(restaurantId: string) {
    return this.db.members.some((m) => m.restaurantId === restaurantId && m.userId === this.uid)
  }

  private requireMember(restaurantId: string) {
    if (!this.isMember(restaurantId)) fail('Not your restaurant')
  }

  private notify(userId: string, kind: NoteKind, text: string, extra: Partial<Note> = {}) {
    this.db.notes.unshift({ id: rid('n'), userId, kind, text, read: false, at: now(), ...extra })
    this.db.notes = this.db.notes.slice(0, 300)
  }

  private notifyManagers(restaurantId: string, kind: NoteKind, text: string, extra: Partial<Note> = {}) {
    this.db.members.filter((m) => m.restaurantId === restaurantId).forEach((m) => this.notify(m.userId, kind, text, { restaurantId, ...extra }))
  }

  private label(o: Opportunity) {
    return `${o.role === 'Any' ? 'Intro' : o.role} · ${fmtDay(o.start)} ${fmtTime(o.start)}`
  }

  async restore(): Promise<Identity | null> {
    return this.uid ? { id: this.uid, provider: 'demo' } : null
  }

  async signIn(): Promise<Identity> {
    if (!this.uid) {
      this.uid = rid('u')
      store.set(UID, this.uid)
      store.set(SELF, this.uid)
    }
    return { id: this.uid, provider: 'demo' }
  }

  async signOut() {
    this.uid = null
    store.set(UID, '')
  }

  async load(): Promise<Snapshot> {
    this.sync()
    const db = this.db
    const uid = this.uid
    const mine = db.members.filter((m) => m.userId === uid).map((m) => m.restaurantId)
    const cutoff = Date.now() - 60 * DAY
    const opps = db.opps.filter((o) => +new Date(o.end) > cutoff)
    const myOpp = new Set(opps.filter((o) => mine.includes(o.restaurantId)).map((o) => o.id))
    const bookings = db.bookings.filter((b) => b.candidateId === uid || myOpp.has(b.oppId))
    const touched = new Set(bookings.map((b) => b.candidateId))
    return structuredClone({
      me: db.profiles.find((p) => p.id === uid) ?? null,
      myRestaurantIds: mine,
      restaurants: db.restaurants,
      opps,
      bookings,
      quests: db.quests.filter((q) => q.candidateId === uid || mine.includes(q.restaurantId)),
      eligibility: db.eligibility.filter((e) => e.candidateId === uid || mine.includes(e.restaurantId)),
      people: mine.length ? db.profiles.filter((p) => p.id !== uid && (p.discoverable || touched.has(p.id))) : [],
      notes: db.notes.filter((n) => n.userId === uid).slice(0, 60),
    })
  }

  async saveProfile(p: ProfileInput) {
    this.sync()
    if (!this.uid) fail('Sign in first')
    const name = p.name.trim().slice(0, 24) || 'Friend'
    const existing = this.db.profiles.find((x) => x.id === this.uid)
    const next = { ...p, name, id: this.uid!, radiusMi: Math.min(10, Math.max(0.5, p.radiusMi)) }
    if (existing) Object.assign(existing, next)
    else this.db.profiles.push(next)
    this.save()
  }

  async checkCode(code: string) {
    this.sync()
    const c = this.db.codes.find((x) => x.code === code.trim().toUpperCase())
    if (!c || c.uses >= c.maxUses) return 'invalid' as const
    return c.restaurantId ? ('join' as const) : ('new' as const)
  }

  async register(input: RegisterInput) {
    this.sync()
    if (!this.uid) fail('Sign in first')
    const c = this.db.codes.find((x) => x.code === input.code.trim().toUpperCase())
    if (!c || c.uses >= c.maxUses) fail('Code not valid')
    if (c!.restaurantId) {
      if (!this.isMember(c!.restaurantId)) {
        this.db.members.push({ restaurantId: c!.restaurantId, userId: this.uid! })
        c!.uses++
      }
      this.save()
      return c!.restaurantId
    }
    if (!parseMapsUrl(input.mapsUrl).ok) fail('Use a Google Maps link')
    const name = input.name.trim()
    if (name.length < 2 || name.length > 60) fail('Check the name')
    if (!inBounds(input.lat, input.lng)) fail('Outside the Ithaca map')
    const id = rid('r')
    this.db.restaurants.push({
      id, name, cuisine: input.cuisine.trim().slice(0, 30) || 'Restaurant', emoji: input.emoji || '🍽️',
      address: input.address.trim().slice(0, 120), lat: input.lat, lng: input.lng, mapsUrl: input.mapsUrl.trim(),
      color: PALETTE[this.db.restaurants.length % PALETTE.length], autoConfirm: true, createdAt: now(),
    })
    this.db.members.push({ restaurantId: id, userId: this.uid! })
    c!.uses++
    this.save()
    return id
  }

  async setAutoConfirm(restaurantId: string, on: boolean) {
    this.sync()
    this.requireMember(restaurantId)
    this.place(restaurantId).autoConfirm = on
    this.save()
  }

  async post(input: PostInput) {
    this.sync()
    this.requireMember(input.restaurantId)
    const err = validatePost(input)
    if (err) fail(err)
    this.db.opps.push({ ...input, id: rid('o'), filled: 0, cancelled: false, createdAt: now(), skills: [...input.skills], notes: input.notes.trim().slice(0, 200) })
    this.save()
  }

  async cancelOpp(oppId: string) {
    this.sync()
    const o = this.opp(oppId)
    this.requireMember(o.restaurantId)
    if (o.cancelled) return
    o.cancelled = true
    const r = this.place(o.restaurantId)
    this.db.bookings
      .filter((b) => b.oppId === o.id && (holds(b) || b.status === 'invited'))
      .forEach((b) => {
        b.status = 'cancelled'
        b.updatedAt = now()
        this.notify(b.candidateId, 'cancelled', `${r.name} cancelled ${this.label(o)}`, { oppId: o.id, restaurantId: r.id })
      })
    o.filled = 0
    this.save()
  }

  private ctx() {
    return { opps: this.db.opps, bookings: this.db.bookings, eligibility: this.db.eligibility, quests: this.db.quests }
  }

  async book(oppId: string) {
    this.sync()
    const me = this.me()
    const o = this.opp(oppId)
    const r = this.place(o.restaurantId)
    const res = check(me, o, r, this.ctx())
    if (!res.ok) return fail(res.text)
    const status: Booking['status'] = res.confirm ? 'confirmed' : 'pending'
    this.db.bookings.push({ id: rid('b'), oppId, candidateId: me.id, status, source: 'self', createdAt: now(), updatedAt: now() })
    o.filled++
    this.notifyManagers(r.id, status === 'pending' ? 'request' : 'booked', `${me.name} · ${this.label(o)}`, { oppId })
    if (status === 'confirmed') this.notify(me.id, 'booked', `${r.name} · ${this.label(o)}`, { oppId, restaurantId: r.id })
    this.save()
    return status
  }

  async cancelBooking(bookingId: string) {
    this.sync()
    const b = this.db.bookings.find((x) => x.id === bookingId && x.candidateId === this.uid) ?? fail('Not found')
    const o = this.opp(b.oppId)
    if (!holds(b)) fail('Nothing to cancel')
    if (Date.now() >= +new Date(o.start)) fail('Already started')
    b.status = 'cancelled'
    b.updatedAt = now()
    o.filled = Math.max(0, o.filled - 1)
    this.notifyManagers(o.restaurantId, 'withdrawn', `${this.me().name} cancelled · ${this.label(o)}`, { oppId: o.id })
    this.save()
  }

  async decide(bookingId: string, approve: boolean) {
    this.sync()
    const b = this.db.bookings.find((x) => x.id === bookingId) ?? fail('Not found')
    const o = this.opp(b.oppId)
    this.requireMember(o.restaurantId)
    if (b.status !== 'pending') fail('Already handled')
    const r = this.place(o.restaurantId)
    b.status = approve ? 'confirmed' : 'declined'
    b.updatedAt = now()
    if (!approve) o.filled = Math.max(0, o.filled - 1)
    this.notify(b.candidateId, approve ? 'approved' : 'declined', `${r.name} · ${this.label(o)}`, { oppId: o.id, restaurantId: r.id, bookingId })
    this.save()
  }

  async attend(bookingId: string, attended: boolean, eligible?: boolean) {
    this.sync()
    const b = this.db.bookings.find((x) => x.id === bookingId) ?? fail('Not found')
    const o = this.opp(b.oppId)
    this.requireMember(o.restaurantId)
    if (b.status !== 'confirmed') fail('Already recorded')
    if (!canRecord(o)) fail('Not started yet')
    const r = this.place(o.restaurantId)
    b.status = attended ? 'attended' : 'no_show'
    b.updatedAt = now()
    if (attended && o.awardsPoint && !this.db.quests.some((q) => q.bookingId === b.id)) {
      this.db.quests.push({ id: rid('q'), restaurantId: r.id, candidateId: b.candidateId, bookingId: b.id, kind: o.kind, at: now() })
      this.notify(b.candidateId, 'quest', `+1 ⭐ ${r.name}`, { oppId: o.id, restaurantId: r.id, bookingId })
    }
    if (!attended) this.notify(b.candidateId, 'noshow', `Marked absent · ${r.name} · ${this.label(o)}`, { oppId: o.id, restaurantId: r.id })
    if (attended && o.kind !== 'shift' && eligible !== undefined) this.writeEligible(r.id, b.candidateId, eligible)
    this.save()
  }

  private writeEligible(restaurantId: string, candidateId: string, eligible: boolean) {
    const e = this.db.eligibility.find((x) => x.restaurantId === restaurantId && x.candidateId === candidateId)
    const was = !!e?.eligible
    if (e) e.eligible = eligible
    else this.db.eligibility.push({ restaurantId, candidateId, eligible })
    if (eligible && !was) this.notify(candidateId, 'eligible', `🔓 Shifts unlocked · ${this.place(restaurantId).name}`, { restaurantId })
  }

  async setEligible(restaurantId: string, candidateId: string, eligible: boolean) {
    this.sync()
    this.requireMember(restaurantId)
    this.writeEligible(restaurantId, candidateId, eligible)
    this.save()
  }

  async invite(oppId: string, candidateId: string) {
    this.sync()
    const o = this.opp(oppId)
    this.requireMember(o.restaurantId)
    const c = this.db.profiles.find((p) => p.id === candidateId) ?? fail('Not found')
    if (o.cancelled || Date.now() >= +new Date(o.start)) fail('Too late')
    if (o.kind === 'shift' && !this.db.eligibility.some((e) => e.restaurantId === o.restaurantId && e.candidateId === c.id && e.eligible)) fail('Needs intro first')
    if (this.db.bookings.some((b) => b.oppId === o.id && b.candidateId === c.id && ['invited', 'pending', 'confirmed'].includes(b.status))) fail('Already in')
    const r = this.place(o.restaurantId)
    const id = rid('b')
    this.db.bookings.push({ id, oppId, candidateId: c.id, status: 'invited', source: 'invite', createdAt: now(), updatedAt: now() })
    this.notify(c.id, 'invite', `${r.name} invited you · ${this.label(o)}`, { oppId, restaurantId: r.id, bookingId: id })
    this.save()
  }

  async respond(bookingId: string, accept: boolean) {
    this.sync()
    const me = this.me()
    const b = this.db.bookings.find((x) => x.id === bookingId && x.candidateId === me.id) ?? fail('Not found')
    if (b.status !== 'invited') fail('Already answered')
    const o = this.opp(b.oppId)
    const r = this.place(o.restaurantId)
    if (accept) {
      const res = check(me, o, r, this.ctx(), Date.now(), true)
      if (!res.ok) fail(res.text)
      b.status = 'confirmed'
      o.filled++
    } else b.status = 'declined'
    b.updatedAt = now()
    this.notifyManagers(r.id, accept ? 'accepted' : 'declined', `${me.name} ${accept ? 'accepted' : 'declined'} · ${this.label(o)}`, { oppId: o.id })
    this.save()
  }

  async readNotes() {
    this.sync()
    this.db.notes.forEach((n) => {
      if (n.userId === this.uid) n.read = true
    })
    this.save()
  }

  demo = {
    people: () => this.db.profiles.filter((p) => p.demo),
    selfId: () => store.get(SELF) || this.uid || '',
    actAs: (id: string) => {
      if (!store.get(SELF) && this.uid) store.set(SELF, this.uid)
      this.uid = id
      store.set(UID, id)
    },
    reset: () => {
      this.db = seed()
      this.save()
    },
  }
}
