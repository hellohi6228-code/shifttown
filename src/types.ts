export type Kind = 'intro' | 'training' | 'shift'

/** invited: manager asked, candidate hasn't answered (holds no spot).
 *  pending: candidate requested, manager hasn't answered (holds a spot).
 *  confirmed → attended | no_show once the day arrives. */
export type BookingStatus = 'invited' | 'pending' | 'confirmed' | 'declined' | 'cancelled' | 'attended' | 'no_show'

export type Stage = 'new' | 'booked' | 'completed' | 'eligible' | 'active'

export interface Look {
  skin: number
  hair: number
  hairColor: number
  outfit: number
  outfitColor: number
  acc: number
}

export interface Profile {
  id: string
  name: string
  look: Look
  area: string
  radiusMi: number
  /** e.g. "sat-eve" — day (sun..sat) + part (am 6–12, pm 12–17, eve 17–24) */
  slots: string[]
  roles: string[]
  skills: string[]
  discoverable: boolean
  demo?: boolean
}

export interface Restaurant {
  id: string
  name: string
  cuisine: string
  emoji: string
  address: string
  lat: number
  lng: number
  mapsUrl: string
  color: string
  autoConfirm: boolean
  createdAt: string
  demo?: boolean
}

export interface Opportunity {
  id: string
  restaurantId: string
  kind: Kind
  role: string
  start: string
  end: string
  openings: number
  filled: number
  /** hourly pay in cents; 0 = unpaid (only allowed for intro) */
  payCents: number
  skills: string[]
  notes: string
  deadline: string
  awardsPoint: boolean
  cancelled: boolean
  createdAt: string
}

export interface Booking {
  id: string
  oppId: string
  candidateId: string
  status: BookingStatus
  source: 'self' | 'invite'
  createdAt: string
  updatedAt: string
}

/** One row per completed qualifying quest. Always scoped to a single restaurant. */
export interface Quest {
  id: string
  restaurantId: string
  candidateId: string
  bookingId: string
  kind: Kind
  at: string
}

export interface Eligibility {
  restaurantId: string
  candidateId: string
  eligible: boolean
}

export type NoteKind = 'booked' | 'request' | 'approved' | 'declined' | 'invite' | 'quest' | 'cancelled' | 'eligible' | 'noshow' | 'withdrawn' | 'accepted'

export interface Note {
  id: string
  userId: string
  kind: NoteKind
  text: string
  oppId?: string
  bookingId?: string
  restaurantId?: string
  read: boolean
  at: string
}

export interface Snapshot {
  me: Profile | null
  myRestaurantIds: string[]
  restaurants: Restaurant[]
  opps: Opportunity[]
  bookings: Booking[]
  quests: Quest[]
  eligibility: Eligibility[]
  people: Profile[]
  notes: Note[]
}

export interface PostInput {
  restaurantId: string
  kind: Kind
  role: string
  start: string
  end: string
  openings: number
  payCents: number
  skills: string[]
  notes: string
  deadline: string
  awardsPoint: boolean
}

export interface RegisterInput {
  code: string
  mapsUrl: string
  name: string
  address: string
  lat: number
  lng: number
  cuisine: string
  emoji: string
}

export type ProfileInput = Omit<Profile, 'id' | 'demo'>
