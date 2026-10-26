// DEMO DATA. The restaurants are real Collegetown and downtown Ithaca places with their
// Google Maps names, addresses and pins. Their training slots, shifts, pay and the people
// are made up for the demo and are labelled as such in the app.
import type { Booking, Kind, Note, Opportunity, Profile, Quest, Restaurant, Review } from '../types'
import { addDays, at, DAY, HOUR } from '../lib/time'

export interface Code {
  code: string
  restaurantId: string | null
  maxUses: number
  uses: number
}

export interface DB {
  v: number
  profiles: Profile[]
  restaurants: Restaurant[]
  members: { restaurantId: string; userId: string }[]
  codes: Code[]
  opps: Opportunity[]
  bookings: Booking[]
  quests: Quest[]
  reviews: Review[]
  notes: Note[]
}

export const DB_VERSION = 7

export const DEMO_CODES = { newPlace: 'DEMO-NEW-1', join: 'DEMO-JOIN' }

const iso = (t: number) => new Date(t).toISOString()

export function seed(nowDate = new Date()): DB {
  const now = nowDate.getTime()
  const today = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate())
  const old = iso(now - 6 * DAY)

  const R = (id: string, name: string, cuisine: string, emoji: string, address: string, lat: number, lng: number, color: string, xp: number): Restaurant => ({
    id, name, cuisine, emoji, address, lat, lng, color, xp, demo: true, createdAt: iso(now - 30 * DAY),
    mapsUrl: `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(`${name}, ${address}, Ithaca, NY`)}`,
  })
  // Pins from Google Maps (October 2026).
  const restaurants = [
    // Downtown / the Commons
    R('r1', 'Ithaca Ale House', 'Bar & grill', '🍔', '301 E State St', 42.4394313, -76.4952839, '#FF8FB1', 19),
    R('r2', 'Lev Kitchen', 'Middle Eastern', '🧆', '222 E State St', 42.4397568, -76.4958783, '#B79CFF', 9),
    R('r3', 'Mercato Bar & Kitchen', 'Italian', '🍝', '108 N Aurora St', 42.4399756, -76.4958157, '#FFB38A', 6),
    R('r4', 'Moosewood', 'Vegetarian', '🥗', '215 N Cayuga St', 42.4405978, -76.4985683, '#5CC49E', 12),
    R('r5', 'Komonz Grill', 'Grill', '🍽️', '146 E State St', 42.4396927, -76.497278, '#7FD3E8', 3),
    R('r6', 'Tavern on the Commons', 'Tavern', '🍺', '130 E Seneca St', 42.440806, -76.4970525, '#FFC46B', 4),
    // Collegetown
    R('r7', 'Collegetown Bagels', 'Bagel shop', '🥯', '420 College Ave', 42.4422042, -76.4855014, '#FFD25A', 7),
    R('r8', 'Oishii Bowl', 'Japanese', '🍜', '401 College Ave', 42.4417167, -76.4851229, '#6EC6FF', 5),
    R('r9', "Xi'an Street Food", 'Chinese', '🥟', '120 Dryden Rd', 42.4417411, -76.4856994, '#FF9AA2', 4),
    R('r10', 'Thai Joy', 'Thai', '🍛', '100 Dryden Rd', 42.4418294, -76.4865112, '#A8E07A', 2),
    R('r11', 'Souvlaki House', 'Greek', '🥙', '315 Eddy St', 42.441395, -76.487224, '#8ED1FC', 6),
    R('r12', 'Bibibowl Asian Grill', 'Asian grill', '🍚', '202 Dryden Rd', 42.4417225, -76.4848456, '#C3A6FF', 2),
  ]

  const P = (id: string, name: string, look: Profile['look'], area: string, roles: string[], skills: string[], slots: string[]): Profile => ({
    id, name, look, area, roles, skills, slots, radiusMi: 2.5, demo: true,
  })
  const eve = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => `${d}-eve`)
  const wkend = ['sat-am', 'sat-pm', 'sun-am', 'sun-pm']
  const mornings = ['mon', 'tue', 'wed', 'thu', 'fri', 'sat', 'sun'].map((d) => `${d}-am`)
  const people = [
    P('c1', 'Maya', { skin: 1, hair: 2, hairColor: 1, outfit: 1, outfitColor: 0, acc: 0 }, 'collegetown', ['Server', 'Host'], ['Food handler', 'POS'], [...eve, ...wkend]),
    P('c2', 'Jordan', { skin: 4, hair: 5, hairColor: 0, outfit: 3, outfitColor: 3, acc: 0 }, 'downtown', ['Line cook', 'Prep cook'], ['ServSafe', 'Knife skills', 'Food handler'], [...eve, 'sat-pm', 'sun-pm', 'wed-pm', 'thu-pm']),
    P('c3', 'Priya', { skin: 2, hair: 3, hairColor: 0, outfit: 2, outfitColor: 4, acc: 1 }, 'southhill', ['Barista', 'Cashier'], ['Espresso', 'POS', 'Mandarin'], [...mornings, 'tue-pm', 'thu-pm']),
    P('c4', 'Leo', { skin: 0, hair: 4, hairColor: 2, outfit: 0, outfitColor: 1, acc: 2 }, 'fallcreek', ['Dishwasher', 'Busser'], ['Lift 40 lb'], [...eve, 'mon-pm', 'tue-pm', 'wed-pm', 'thu-pm', 'fri-pm']),
    P('c5', 'Sam', { skin: 3, hair: 6, hairColor: 0, outfit: 2, outfitColor: 2, acc: 5 }, 'northside', ['Delivery', 'Cashier'], [], [...eve, ...wkend]),
    P('c6', 'Ana', { skin: 2, hair: 1, hairColor: 4, outfit: 0, outfitColor: 5, acc: 4 }, 'westhill', ['Server', 'Bartender'], ['Alcohol (ATAP)', 'Spanish', 'POS'], [...eve, ...wkend]),
  ]

  const opps: Opportunity[] = []
  let n = 0
  const O = (restaurantId: string, kind: Kind, role: string, dayOffset: number, from: string, to: string, openings: number, pay: number, extra: Partial<Opportunity> = {}): Opportunity => {
    const day = addDays(today, dayOffset)
    const start = at(day, from)
    const o: Opportunity = {
      id: `o${++n}`, restaurantId, kind, role, start, end: at(day, to), openings, filled: 0, payCents: Math.round(pay * 100),
      skills: [], notes: '', deadline: iso(+new Date(start) - HOUR), cancelled: false, createdAt: old, ...extra,
    }
    opps.push(o)
    return o
  }
  const T = (restaurantId: string, dayOffset: number, from: string, to: string, openings: number, extra: Partial<Opportunity> = {}) =>
    O(restaurantId, 'training', 'Training', dayOffset, from, to, openings, 16, extra)

  // A training later today (tomorrow morning if it's late), so training → check-in →
  // check-out → unlocked store can all be tried in one sitting.
  const HALF = 30 * 60_000
  let soon = new Date(Math.ceil((now + 20 * 60_000) / HALF) * HALF)
  const late = soon.getDate() !== nowDate.getDate()
  if (late) soon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 10, 0)
  const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  T('r1', late ? 1 : 0, hm(soon), '23:59', 4, { end: iso(+soon + HALF), deadline: iso(+soon - 10 * 60_000) })
  T('r1', 2, '14:00', '15:00', 2)
  const g1 = O('r1', 'shift', 'Server', 1, '17:00', '22:00', 2, 18)
  const g2 = O('r1', 'shift', 'Server', 3, '17:00', '23:00', 1, 18)
  O('r1', 'shift', 'Dishwasher', 5, '16:00', '22:00', 2, 17)
  O('r1', 'shift', 'Line cook', 4, '11:00', '15:00', 1, 19, { skills: ['Food handler'] })

  T('r2', 1, '15:00', '15:30', 4)
  O('r2', 'shift', 'Server', 1, '18:00', '22:00', 2, 17)
  O('r2', 'shift', 'Line cook', 4, '17:00', '22:00', 1, 18, { skills: ['Food handler'] })

  T('r3', 1, '10:00', '10:30', 3)
  O('r3', 'shift', 'Bartender', ((6 - today.getDay() + 7) % 7) || 7, '17:00', '23:00', 2, 17, { skills: ['Alcohol (ATAP)'] })

  T('r4', 2, '10:00', '10:30', 2)
  O('r4', 'shift', 'Prep cook', 3, '09:00', '14:00', 1, 17.5)

  T('r5', 3, '15:00', '15:30', 2)
  O('r5', 'shift', 'Line cook', 5, '17:00', '22:00', 1, 18)

  T('r6', 2, '16:00', '16:30', 2)
  O('r6', 'shift', 'Server', 4, '17:00', '23:00', 2, 17)

  T('r7', 2, '09:00', '09:30', 2)
  O('r7', 'shift', 'Barista', 4, '06:30', '11:30', 1, 17, { skills: ['Espresso'] })
  O('r7', 'shift', 'Cashier', 3, '07:00', '12:00', 2, 16.5)

  const p1 = T('r8', 1, '16:00', '16:30', 3)
  O('r8', 'shift', 'Line cook', 2, '17:00', '22:00', 1, 18)

  T('r9', 3, '14:00', '14:30', 2)
  O('r9', 'shift', 'Cashier', 5, '11:00', '16:00', 1, 16.5)

  T('r10', 1, '15:00', '15:30', 2)
  O('r10', 'shift', 'Server', 2, '17:00', '21:30', 2, 17)

  T('r11', 2, '14:00', '14:30', 2)
  O('r11', 'shift', 'Prep cook', 6, '16:00', '22:00', 1, 18.5, { skills: ['Knife skills'] })

  T('r12', 4, '15:00', '15:30', 2)
  O('r12', 'shift', 'Line cook', 6, '17:00', '22:00', 1, 18)

  // Today and the last two days — things for Ithaca Ale House to check in, check out and review.
  const tShift = O('r1', 'shift', 'Server', 0, '10:00', '14:00', 1, 18)
  const yShift = O('r1', 'shift', 'Line cook', -1, '16:00', '22:00', 1, 19)
  const dShift = O('r1', 'shift', 'Server', -2, '17:00', '22:00', 2, 18)

  // History
  const hT1 = T('r1', -10, '15:00', '15:30', 4)
  const hR1 = [-8, -7, -5, -4].map((d) => O('r1', 'shift', 'Server', d, '17:00', '22:00', 2, 18))
  const hT2 = T('r2', -20, '15:00', '15:30', 3)
  const hR2 = [-18, -15, -11, -6].map((d) => O('r2', 'shift', 'Server', d, '18:00', '22:00', 1, 17))
  const hT6 = T('r4', -14, '09:00', '09:30', 2)
  const hR6 = O('r4', 'shift', 'Server', -9, '11:00', '15:00', 1, 16.5)
  const hT3 = T('r7', -12, '09:00', '09:30', 2)

  const bookings: Booking[] = []
  const quests: Quest[] = []
  const reviews: Review[] = []
  let b = 0
  const B = (o: Opportunity, candidateId: string, status: Booking['status'], stars?: number) => {
    const start = +new Date(o.start)
    const bk: Booking = { id: `b${++b}`, oppId: o.id, candidateId, status, createdAt: iso(start - 2 * DAY), updatedAt: iso(start - DAY) }
    if (status === 'checked_in' || status === 'done') bk.checkInAt = iso(start - 5 * 60_000)
    if (status === 'done') bk.checkOutAt = o.end
    bookings.push(bk)
    o.filled++
    if (status === 'done') quests.push({ id: `q${quests.length + 1}`, restaurantId: o.restaurantId, candidateId, bookingId: bk.id, kind: o.kind, at: o.end })
    if (stars) reviews.push({ id: `rv${reviews.length + 1}`, bookingId: bk.id, restaurantId: o.restaurantId, candidateId, stars, at: o.end })
  }

  B(hT1, 'c1', 'done', 5)
  B(hT1, 'c2', 'done', 4)
  B(hT1, 'c6', 'done', 5)
  B(hR1[0], 'c6', 'done', 5)
  B(hR1[1], 'c1', 'done', 5)
  B(hR1[2], 'c6', 'done', 5)
  B(hR1[3], 'c1', 'done', 4)
  B(hT2, 'c1', 'done', 5)
  hR2.forEach((o, i) => B(o, 'c1', 'done', i === 2 ? 4 : 5))
  B(hT6, 'c3', 'done', 5)
  B(hR6, 'c3', 'done', 5)
  B(hT3, 'c3', 'done', 4)

  B(g1, 'c1', 'confirmed')
  B(g2, 'c6', 'pending')
  B(p1, 'c4', 'confirmed')
  B(tShift, 'c6', 'confirmed')
  B(yShift, 'c2', 'checked_in')
  B(dShift, 'c6', 'done')

  return {
    v: DB_VERSION,
    profiles: people,
    restaurants,
    members: [],
    codes: [
      { code: 'DEMO-NEW-1', restaurantId: null, maxUses: 1, uses: 0 },
      { code: 'DEMO-NEW-2', restaurantId: null, maxUses: 1, uses: 0 },
      { code: 'DEMO-NEW-3', restaurantId: null, maxUses: 1, uses: 0 },
      { code: 'DEMO-JOIN', restaurantId: 'r1', maxUses: 99, uses: 0 },
    ],
    opps,
    bookings,
    quests,
    reviews,
    notes: [],
  }
}
