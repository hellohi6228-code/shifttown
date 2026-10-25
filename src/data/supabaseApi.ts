// Production backend. Reads go straight to tables (filtered by RLS);
// every write is a Postgres function that enforces the booking rules under row locks.
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import type { Booking, Eligibility, Note, Opportunity, PostInput, Profile, ProfileInput, Quest, RegisterInput, Restaurant, Snapshot } from '../types'
import { isNative, nativeSignIn } from '../auth/native'
import { DAY } from '../lib/time'
import { fail, type Api, type Identity } from './api'

/* eslint-disable @typescript-eslint/no-explicit-any */
type Row = Record<string, any>

const toProfile = (r: Row): Profile => ({
  id: r.id, name: r.name, look: r.look, area: r.area, radiusMi: Number(r.radius_mi),
  slots: r.slots ?? [], roles: r.roles ?? [], skills: r.skills ?? [], discoverable: r.discoverable,
})
const toRestaurant = (r: Row): Restaurant => ({
  id: r.id, name: r.name, cuisine: r.cuisine, emoji: r.emoji, address: r.address, lat: r.lat, lng: r.lng,
  mapsUrl: r.maps_url, color: r.color, autoConfirm: r.auto_confirm, createdAt: r.created_at,
})
const toOpp = (r: Row): Opportunity => ({
  id: r.id, restaurantId: r.restaurant_id, kind: r.kind, role: r.role, start: r.starts_at, end: r.ends_at,
  openings: r.openings, filled: r.filled, payCents: r.pay_cents, skills: r.skills ?? [], notes: r.notes,
  deadline: r.deadline, awardsPoint: r.awards_point, cancelled: r.cancelled, createdAt: r.created_at,
})
const toBooking = (r: Row): Booking => ({
  id: r.id, oppId: r.opportunity_id, candidateId: r.candidate_id, status: r.status, source: r.source,
  createdAt: r.created_at, updatedAt: r.updated_at,
})
const toQuest = (r: Row): Quest => ({ id: r.id, restaurantId: r.restaurant_id, candidateId: r.candidate_id, bookingId: r.booking_id, kind: r.kind, at: r.created_at })
const toElig = (r: Row): Eligibility => ({ restaurantId: r.restaurant_id, candidateId: r.candidate_id, eligible: r.eligible })
const toNote = (r: Row): Note => ({
  id: r.id, userId: r.user_id, kind: r.kind, text: r.text, oppId: r.opportunity_id ?? undefined,
  bookingId: r.booking_id ?? undefined, restaurantId: r.restaurant_id ?? undefined, read: r.read, at: r.created_at,
})

export class SupabaseApi implements Api {
  mode = 'live' as const
  private sb: SupabaseClient
  private uid: string | null = null

  constructor(url: string, key: string) {
    this.sb = createClient(url, key, { auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: !isNative } })
  }

  private async rpc<T = unknown>(fn: string, args: Record<string, unknown> = {}): Promise<T> {
    const { data, error } = await this.sb.rpc(fn, args)
    if (error) fail(error.message || 'Something went wrong')
    return data as T
  }

  private async rows(q: PromiseLike<{ data: Row[] | null; error: { message: string } | null }>) {
    const { data, error } = await q
    if (error) fail(error.message)
    return data ?? []
  }

  async restore(): Promise<Identity | null> {
    const { data } = await this.sb.auth.getSession()
    let user = data.session?.user
    if (!user && isNative) {
      // Android: the Play account can be picked up without a tap.
      const tok = await nativeSignIn(true).catch(() => null)
      if (tok) {
        const res = await this.sb.auth.signInWithIdToken({ provider: tok.provider, token: tok.idToken, nonce: tok.nonce })
        user = res.data.user ?? undefined
      }
    }
    if (!user) return null
    this.uid = user.id
    return { id: user.id, provider: user.app_metadata.provider === 'apple' ? 'apple' : 'google' }
  }

  async signIn(): Promise<Identity> {
    const tok = await nativeSignIn()
    if (!tok) {
      // Desktop browser fallback (PWA): redirect to Google, session is restored on return.
      await this.sb.auth.signInWithOAuth({ provider: 'google', options: { redirectTo: location.origin } })
      return new Promise(() => {})
    }
    const { data, error } = await this.sb.auth.signInWithIdToken({ provider: tok.provider, token: tok.idToken, nonce: tok.nonce })
    if (error || !data.user) fail(error?.message ?? 'Sign-in failed')
    this.uid = data.user!.id
    return { id: data.user!.id, provider: tok.provider }
  }

  async signOut() {
    await this.sb.auth.signOut()
    this.uid = null
  }

  async load(): Promise<Snapshot> {
    const uid = this.uid ?? fail('Sign in first')
    const since = new Date(Date.now() - 60 * DAY).toISOString()
    const [me, members, restaurants, opps, bookings, quests, elig, people, notes] = await Promise.all([
      this.rows(this.sb.from('profiles').select('*').eq('id', uid)),
      this.rows(this.sb.from('restaurant_members').select('restaurant_id').eq('user_id', uid)),
      this.rows(this.sb.from('restaurants').select('*')),
      this.rows(this.sb.from('opportunities').select('*').gte('ends_at', since).order('starts_at')),
      this.rows(this.sb.from('bookings').select('*')),
      this.rows(this.sb.from('quests').select('*')),
      this.rows(this.sb.from('eligibility').select('*')),
      this.rows(this.sb.from('profiles').select('*').neq('id', uid).limit(500)),
      this.rows(this.sb.from('notifications').select('*').order('created_at', { ascending: false }).limit(60)),
    ])
    return {
      me: me[0] ? toProfile(me[0]) : null,
      myRestaurantIds: members.map((m) => m.restaurant_id),
      restaurants: restaurants.map(toRestaurant),
      opps: opps.map(toOpp),
      bookings: bookings.map(toBooking),
      quests: quests.map(toQuest),
      eligibility: elig.map(toElig),
      people: people.map(toProfile),
      notes: notes.map(toNote),
    }
  }

  async saveProfile(p: ProfileInput) {
    const uid = this.uid ?? fail('Sign in first')
    const { error } = await this.sb.from('profiles').upsert({
      id: uid, name: p.name.trim().slice(0, 24) || 'Friend', look: p.look, area: p.area, radius_mi: p.radiusMi,
      slots: p.slots, roles: p.roles, skills: p.skills, discoverable: p.discoverable,
    })
    if (error) fail(error.message)
  }

  checkCode = (code: string) => this.rpc<'new' | 'join' | 'invalid'>('check_invite_code', { p_code: code })

  register = (i: RegisterInput) =>
    this.rpc<string>('register_restaurant', {
      p_code: i.code, p_maps_url: i.mapsUrl, p_name: i.name, p_address: i.address,
      p_lat: i.lat, p_lng: i.lng, p_cuisine: i.cuisine, p_emoji: i.emoji,
    })

  setAutoConfirm = async (restaurantId: string, on: boolean) => {
    await this.rpc('set_auto_confirm', { p_restaurant: restaurantId, p_on: on })
  }

  post = async (p: PostInput) => {
    await this.rpc('post_opportunity', {
      p_restaurant: p.restaurantId, p_kind: p.kind, p_role: p.role, p_start: p.start, p_end: p.end,
      p_openings: p.openings, p_pay_cents: p.payCents, p_skills: p.skills, p_notes: p.notes,
      p_deadline: p.deadline, p_awards_point: p.awardsPoint,
    })
  }

  cancelOpp = async (oppId: string) => {
    await this.rpc('cancel_opportunity', { p_opp: oppId })
  }
  book = (oppId: string) => this.rpc<Booking['status']>('book', { p_opp: oppId })
  cancelBooking = async (id: string) => {
    await this.rpc('cancel_booking', { p_booking: id })
  }
  decide = async (id: string, approve: boolean) => {
    await this.rpc('decide_booking', { p_booking: id, p_approve: approve })
  }
  attend = async (id: string, attended: boolean, eligible?: boolean) => {
    await this.rpc('record_attendance', { p_booking: id, p_attended: attended, p_eligible: eligible ?? null })
  }
  setEligible = async (restaurantId: string, candidateId: string, eligible: boolean) => {
    await this.rpc('set_eligibility', { p_restaurant: restaurantId, p_candidate: candidateId, p_eligible: eligible })
  }
  invite = async (oppId: string, candidateId: string) => {
    await this.rpc('invite_candidate', { p_opp: oppId, p_candidate: candidateId })
  }
  respond = async (id: string, accept: boolean) => {
    await this.rpc('respond_invite', { p_booking: id, p_accept: accept })
  }
  readNotes = async () => {
    await this.rpc('read_notes')
  }
}
