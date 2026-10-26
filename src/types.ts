/** training: one per store, unlocks that store's shifts. shift: real paid work. */
export type Kind = 'training' | 'shift'

/** pending → confirmed (by restaurant) → checked_in → done. */
export type BookingStatus = 'pending' | 'confirmed' | 'checked_in' | 'done' | 'declined' | 'cancelled'

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
  /** +1 per finished training/shift, +1 per review given */
  xp: number
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
  /** hourly pay in cents — always paid */
  payCents: number
  skills: string[]
  notes: string
  deadline: string
  cancelled: boolean
  createdAt: string
}

export interface Booking {
  id: string
  oppId: string
  candidateId: string
  status: BookingStatus
  checkInAt?: string
  checkOutAt?: string
  createdAt: string
  updatedAt: string
}

/** One per finished training/shift, always scoped to one restaurant. */
export interface Quest {
  id: string
  restaurantId: string
  candidateId: string
  bookingId: string
  kind: Kind
  at: string
}

export interface Review {
  id: string
  bookingId: string
  restaurantId: string
  candidateId: string
  stars: number
  at: string
}

/** What a restaurant sees about someone who booked with them. */
export interface CandidateStats {
  quests: number
  rating: number | null
  reviews: number
}

export type NoteKind = 'request' | 'confirmed' | 'declined' | 'cancelled' | 'withdrawn' | 'checkin' | 'checkout' | 'quest' | 'unlocked' | 'review'

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
  reviews: Review[]
  people: Profile[]
  stats: Record<string, CandidateStats>
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
