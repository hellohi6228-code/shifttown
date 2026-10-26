import type { PostInput, Profile, ProfileInput, RegisterInput, Snapshot } from '../types'

export interface Identity {
  id: string
  provider: 'apple' | 'google' | 'demo'
}

/** Everything the UI can ask of the backend. Two implementations:
 *  - LocalApi: demo mode, data stays on this device (no Supabase configured)
 *  - SupabaseApi: production, rules enforced in Postgres functions + RLS */
export interface Api {
  mode: 'demo' | 'live'
  /** Existing session, without any UI. */
  restore(): Promise<Identity | null>
  /** App Store (Sign in with Apple) or Google Play (Google account) identity. */
  signIn(): Promise<Identity>
  signOut(): Promise<void>
  load(): Promise<Snapshot>
  saveProfile(p: ProfileInput): Promise<void>
  checkCode(code: string): Promise<'new' | 'join' | 'invalid'>
  register(input: RegisterInput): Promise<string>
  post(input: PostInput): Promise<void>
  cancelOpp(oppId: string): Promise<void>
  /** Candidate asks for a spot; the restaurant confirms. */
  book(oppId: string): Promise<void>
  cancelBooking(bookingId: string): Promise<void>
  confirm(bookingId: string, yes: boolean): Promise<void>
  /** Candidate or restaurant. */
  checkIn(bookingId: string): Promise<void>
  /** Candidate or restaurant. Finishing a training unlocks the store. */
  checkOut(bookingId: string): Promise<void>
  review(bookingId: string, stars: number): Promise<void>
  readNotes(): Promise<void>
  demo?: {
    people(): Profile[]
    selfId(): string
    actAs(id: string): void
    reset(): void
  }
}

export class UserError extends Error {}
export const fail = (msg: string): never => {
  throw new UserError(msg)
}
