// Demo backend: same rules as the Postgres functions, stored in localStorage.
import type { Booking, CandidateStats, Note, NoteKind, Opportunity, PostInput, ProfileInput, RegisterInput, Snapshot } from '../types'
import { inBounds, parseMapsUrl } from '../lib/geo'
import { canCheckIn, canCheckOut, check, holds, title, validatePost, type By } from '../lib/rules'
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
  private uid: string | null = store.get(UID) || null

  constructor() {
    this.db = seed()
    this.sync()
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

  private name(id: string) {
    return this.db.profiles.find((p) => p.id === id)?.name ?? 'Someone'
  }

  private notify(userId: string, kind: NoteKind, text: string, extra: Partial<Note> = {}) {
    this.db.notes.unshift({ id: rid('n'), userId, kind, text, read: false, at: now(), ...extra })
    this.db.notes = this.db.notes.slice(0, 300)
  }

  private notifyManagers(restaurantId: string, kind: NoteKind, text: string, extra: Partial<Note> = {}) {
    this.db.members.filter((m) => m.restaurantId === restaurantId).forEach((m) => this.notify(m.userId, kind, text, { restaurantId, ...extra }))
  }

  private label(o: Opportunity) {
    return `${title(o)} · ${fmtDay(o.start)} ${fmtTime(o.start)}`
  }

  /** The booking plus who is acting on it. */
  private actor(bookingId: string): { b: Booking; o: Opportunity; by: By } {
    const b = this.db.bookings.find((x) => x.id === bookingId) ?? fail('Not found')
    const o = this.opp(b.oppId)
    if (b.candidateId === this.uid) return { b, o, by: 'candidate' }
    if (this.isMember(o.restaurantId)) return { b, o, by: 'restaurant' }
    return fail('Not yours')
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
    const myOpp = new Set(db.opps.filter((o) => mine.includes(o.restaurantId)).map((o) => o.id))
    const bookings = db.bookings.filter((b) => b.candidateId === uid || myOpp.has(b.oppId))
    // Restaurants only see people who booked with them.
    const seen = new Set(bookings.filter((b) => myOpp.has(b.oppId)).map((b) => b.candidateId))
    const stats: Record<string, CandidateStats> = {}
    seen.forEach((id) => {
      const rv = db.reviews.filter((r) => r.candidateId === id)
      stats[id] = {
        quests: db.quests.filter((q) => q.candidateId === id).length,
        rating: rv.length ? rv.reduce((s, r) => s + r.stars, 0) / rv.length : null,
        reviews: rv.length,
      }
    })
    return structuredClone({
      me: db.profiles.find((p) => p.id === uid) ?? null,
      myRestaurantIds: mine,
      restaurants: db.restaurants,
      opps,
      bookings,
      quests: db.quests.filter((q) => q.candidateId === uid || mine.includes(q.restaurantId)),
      reviews: db.reviews.filter((r) => r.candidateId === uid || mine.includes(r.restaurantId)),
      people: db.profiles.filter((p) => seen.has(p.id) && p.id !== uid),
      stats,
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
    if (!c || c.uses >= c.maxUses) return fail('Code not valid')
    if (c.restaurantId) {
      if (!this.isMember(c.restaurantId)) {
        this.db.members.push({ restaurantId: c.restaurantId, userId: this.uid! })
        c.uses++
      }
      this.save()
      return c.restaurantId
    }
    if (!parseMapsUrl(input.mapsUrl).ok) fail('Use a Google Maps link')
    const name = input.name.trim()
    if (name.length < 2 || name.length > 60) fail('Check the name')
    if (!inBounds(input.lat, input.lng)) fail('Outside the Ithaca map')
    const id = rid('r')
    this.db.restaurants.push({
      id, name, cuisine: input.cuisine.trim().slice(0, 30) || 'Restaurant', emoji: input.emoji || '🍽️',
      address: input.address.trim().slice(0, 120), lat: input.lat, lng: input.lng, mapsUrl: input.mapsUrl.trim(),
      color: PALETTE[this.db.restaurants.length % PALETTE.length], xp: 0, createdAt: now(),
    })
    this.db.members.push({ restaurantId: id, userId: this.uid! })
    c.uses++
    this.save()
    return id
  }

  async post(input: PostInput) {
    this.sync()
    if (!this.isMember(input.restaurantId)) fail('Not your restaurant')
    const err = validatePost(input)
    if (err) fail(err)
    this.db.opps.push({ ...input, id: rid('o'), filled: 0, cancelled: false, createdAt: now(), skills: [...input.skills], notes: input.notes.trim().slice(0, 200) })
    this.save()
  }

  async cancelOpp(oppId: string) {
    this.sync()
    const o = this.opp(oppId)
    if (!this.isMember(o.restaurantId)) fail('Not your restaurant')
    if (o.cancelled) return
    const r = this.place(o.restaurantId)
    o.cancelled = true
    this.db.bookings
      .filter((b) => b.oppId === o.id && (b.status === 'pending' || b.status === 'confirmed'))
      .forEach((b) => {
        b.status = 'cancelled'
        b.updatedAt = now()
        this.notify(b.candidateId, 'cancelled', `${r.name} cancelled ${this.label(o)}`, { oppId: o.id, restaurantId: r.id })
      })
    o.filled = this.db.bookings.filter((b) => b.oppId === o.id && (holds(b) || b.status === 'done')).length
    this.save()
  }

  private ctx() {
    return { opps: this.db.opps, bookings: this.db.bookings, quests: this.db.quests }
  }

  async book(oppId: string) {
    this.sync()
    const me = this.me()
    const o = this.opp(oppId)
    const res = check(me, o, this.ctx())
    if (!res.ok) return fail(res.text)
    this.db.bookings.push({ id: rid('b'), oppId, candidateId: me.id, status: 'pending', createdAt: now(), updatedAt: now() })
    o.filled++
    this.notifyManagers(o.restaurantId, 'request', `${me.name} · ${this.label(o)}`, { oppId })
    this.save()
  }

  async cancelBooking(bookingId: string) {
    this.sync()
    const { b, o, by } = this.actor(bookingId)
    if (by !== 'candidate') fail('Not yours')
    if (b.status !== 'pending' && b.status !== 'confirmed') fail('Nothing to cancel')
    if (Date.now() >= +new Date(o.start)) fail('Already started')
    b.status = 'cancelled'
    b.updatedAt = now()
    o.filled = Math.max(0, o.filled - 1)
    this.notifyManagers(o.restaurantId, 'withdrawn', `${this.name(b.candidateId)} cancelled · ${this.label(o)}`, { oppId: o.id })
    this.save()
  }

  private forRestaurant(bookingId: string) {
    const b = this.db.bookings.find((x) => x.id === bookingId) ?? fail('Not found')
    const o = this.opp(b.oppId)
    if (!this.isMember(o.restaurantId)) fail('Not your restaurant')
    return { b, o }
  }

  async confirm(bookingId: string, yes: boolean) {
    this.sync()
    const { b, o } = this.forRestaurant(bookingId)
    if (b.status !== 'pending') fail('Already handled')
    const r = this.place(o.restaurantId)
    b.status = yes ? 'confirmed' : 'declined'
    b.updatedAt = now()
    if (!yes) o.filled = Math.max(0, o.filled - 1)
    this.notify(b.candidateId, yes ? 'confirmed' : 'declined', `${r.name} · ${this.label(o)}`, { oppId: o.id, restaurantId: r.id, bookingId })
    this.save()
  }

  async checkIn(bookingId: string) {
    this.sync()
    const { b, o, by } = this.actor(bookingId)
    if (!canCheckIn(o, b, by)) fail(b.status === 'confirmed' ? 'Opens 1 hour before' : 'Not confirmed')
    b.status = 'checked_in'
    b.checkInAt = now()
    b.updatedAt = now()
    const r = this.place(o.restaurantId)
    if (by === 'candidate') this.notifyManagers(r.id, 'checkin', `${this.name(b.candidateId)} checked in · ${this.label(o)}`, { oppId: o.id })
    else this.notify(b.candidateId, 'checkin', `Checked in · ${r.name}`, { oppId: o.id, restaurantId: r.id, bookingId })
    this.save()
  }

  async checkOut(bookingId: string) {
    this.sync()
    const { b, o, by } = this.actor(bookingId)
    if (!canCheckOut(o, b, by)) fail('Check in first')
    const r = this.place(o.restaurantId)
    b.status = 'done'
    b.checkOutAt = now()
    b.updatedAt = now()
    r.xp++
    if (!this.db.quests.some((q) => q.bookingId === b.id))
      this.db.quests.push({ id: rid('q'), restaurantId: r.id, candidateId: b.candidateId, bookingId: b.id, kind: o.kind, at: now() })
    this.notify(b.candidateId, o.kind === 'training' ? 'unlocked' : 'quest', o.kind === 'training' ? `🔓 ${r.name} unlocked` : `+1 ⭐ ${r.name}`, { oppId: o.id, restaurantId: r.id, bookingId })
    if (by === 'candidate') this.notifyManagers(r.id, 'checkout', `${this.name(b.candidateId)} checked out · ${this.label(o)}`, { oppId: o.id })
    this.save()
  }

  async review(bookingId: string, stars: number) {
    this.sync()
    const { b, o } = this.forRestaurant(bookingId)
    if (b.status !== 'done') fail('Not finished yet')
    if (!(stars >= 1 && stars <= 5)) fail('1 to 5 stars')
    if (this.db.reviews.some((r) => r.bookingId === b.id)) fail('Already reviewed')
    const r = this.place(o.restaurantId)
    this.db.reviews.push({ id: rid('rv'), bookingId: b.id, restaurantId: r.id, candidateId: b.candidateId, stars, at: now() })
    r.xp++
    this.notify(b.candidateId, 'review', `${'★'.repeat(stars)} from ${r.name}`, { oppId: o.id, restaurantId: r.id, bookingId })
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
