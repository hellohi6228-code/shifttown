// DEMO DATA — fictional restaurants and people placed in real Ithaca neighborhoods.
import type { Booking, Eligibility, Kind, Note, Opportunity, Profile, Quest, Restaurant } from '../types'
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
  eligibility: Eligibility[]
  notes: Note[]
}

export const DB_VERSION = 5

export const DEMO_CODES = { newPlace: 'DEMO-NEW-1', joinGorge: 'DEMO-GORGE' }

const iso = (t: number) => new Date(t).toISOString()

export function seed(nowDate = new Date()): DB {
  const now = nowDate.getTime()
  const today = new Date(nowDate.getFullYear(), nowDate.getMonth(), nowDate.getDate())
  const old = iso(now - 6 * DAY)
  const fresh = iso(now - 3 * HOUR)

  const R = (id: string, name: string, cuisine: string, emoji: string, address: string, lat: number, lng: number, color: string, autoConfirm: boolean): Restaurant => ({
    id, name, cuisine, emoji, address, lat, lng, color, autoConfirm, demo: true, createdAt: iso(now - 30 * DAY),
    mapsUrl: `https://www.google.com/maps/place/${encodeURIComponent(name)}/@${lat},${lng},17z`,
  })
  const restaurants = [
    R('r1', 'Gorge Grill', 'Burgers', '🍔', '120 E State St', 42.44203, -76.4955, '#FF8FB1', false),
    R('r2', 'Cayuga Noodle Bar', 'Ramen', '🍜', '210 W State St', 42.43733, -76.5025, '#6EC6FF', true),
    R('r3', 'Hilltop Bagels', 'Bagels & coffee', '🥯', '401 College Ave', 42.43928, -76.482, '#FFD25A', true),
    R('r4', 'Fall Creek Pizza', 'Pizza', '🍕', '516 N Aurora St', 42.44908, -76.5, '#5CC49E', false),
    R('r5', 'Inlet Taqueria', 'Tacos', '🌮', '330 W Buffalo St', 42.44242, -76.50925, '#FFB38A', true),
    R('r6', 'South Hill Café', 'Café', '🥐', '950 Danby Rd', 42.42597, -76.492, '#B79CFF', true),
    R('r7', 'Six Mile Sushi', 'Sushi', '🍣', '314 S Aurora St', 42.43576, -76.494, '#7FD3E8', true),
    R('r8', 'Lakeside Market Kitchen', 'Farm to table', '🥗', '545 Third St', 42.45103, -76.50175, '#A8E07A', true),
  ]

  const P = (id: string, name: string, look: Profile['look'], area: string, roles: string[], skills: string[], slots: string[]): Profile => ({
    id, name, look, area, roles, skills, slots, radiusMi: 2.5, discoverable: true, demo: true,
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
    P('c6', 'Ana', { skin: 2, hair: 1, hairColor: 4, outfit: 0, outfitColor: 5, acc: 4 }, 'westhill', ['Server', 'Bartender'], ['Alcohol (ATAP)', 'Spanish', 'POS'], [...eve, ...wkend, 'sat-eve']),
  ]

  const opps: Opportunity[] = []
  let n = 0
  const O = (restaurantId: string, kind: Kind, role: string, dayOffset: number, from: string, to: string, openings: number, pay: number, extra: Partial<Opportunity> = {}): Opportunity => {
    const day = addDays(today, dayOffset)
    const start = at(day, from)
    const end = at(day, to)
    const o: Opportunity = {
      id: `o${++n}`, restaurantId, kind, role, start, end, openings, filled: 0, payCents: Math.round(pay * 100),
      skills: [], notes: '', deadline: iso(+new Date(start) - (kind === 'intro' ? 1 : 2) * HOUR),
      awardsPoint: true, cancelled: false, createdAt: old, ...extra,
    }
    opps.push(o)
    return o
  }

  // An intro later today (tomorrow morning if it's late), so the whole
  // intro → attendance → shift loop can be tried in one sitting.
  const HALF = 30 * 60_000
  let soon = new Date(Math.ceil((now + 45 * 60_000) / HALF) * HALF)
  const late = soon.getDate() !== nowDate.getDate()
  if (late) soon = new Date(today.getFullYear(), today.getMonth(), today.getDate() + 1, 10, 0)
  const hm = (d: Date) => `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`

  // Upcoming
  O('r1', 'intro', 'Any', late ? 1 : 0, hm(soon), '23:59', 4, 0, { end: iso(+soon + HALF), deadline: iso(+soon - 10 * 60_000), notes: 'Meet the team. Bring ID.' })
  O('r1', 'training', 'Line cook', 2, '14:00', '16:00', 2, 17, { notes: 'Grill station basics' })
  const g1 = O('r1', 'shift', 'Server', 1, '17:00', '22:00', 2, 18, { notes: 'Black shirt' })
  const g2 = O('r1', 'shift', 'Server', 3, '17:00', '23:00', 1, 18)
  O('r1', 'shift', 'Dishwasher', 5, '16:00', '22:00', 2, 17)
  O('r1', 'shift', 'Line cook', 4, '11:00', '15:00', 1, 19, { skills: ['Food handler'], createdAt: fresh })

  O('r2', 'intro', 'Any', 1, '15:00', '15:30', 4, 0)
  O('r2', 'shift', 'Server', 1, '18:00', '22:00', 2, 17)
  O('r2', 'shift', 'Line cook', 4, '17:00', '22:00', 1, 18, { skills: ['Food handler'] })

  O('r3', 'intro', 'Any', 2, '09:00', '09:30', 2, 16, { notes: 'Paid intro' })
  O('r3', 'training', 'Barista', 3, '07:00', '10:00', 2, 16.5)
  O('r3', 'shift', 'Barista', 4, '06:30', '11:30', 1, 17, { skills: ['Espresso'], createdAt: fresh })

  const p1 = O('r4', 'intro', 'Any', 1, '16:00', '16:30', 3, 0, { createdAt: fresh })
  O('r4', 'shift', 'Delivery', 2, '17:00', '23:00', 2, 16, { createdAt: fresh, notes: 'Bike or car' })

  O('r5', 'intro', 'Any', 3, '15:00', '15:30', 2, 0)
  O('r5', 'shift', 'Line cook', 5, '17:00', '22:00', 1, 18, { skills: ['Food handler'] })

  O('r7', 'intro', 'Any', 2, '14:00', '14:30', 2, 0, { createdAt: fresh })
  O('r7', 'shift', 'Prep cook', 6, '16:00', '22:00', 1, 18.5, { skills: ['Knife skills'], createdAt: fresh })

  O('r8', 'intro', 'Any', 1, '10:00', '10:30', 3, 0)
  O('r8', 'shift', 'Cashier', ((6 - today.getDay() + 7) % 7) || 7, '08:00', '13:00', 3, 16.5, { notes: 'Market day' })

  // Today + yesterday — waiting for the manager to record attendance
  const tShift = O('r1', 'shift', 'Server', 0, '10:00', '14:00', 1, 18)
  const yShift = O('r1', 'shift', 'Line cook', -1, '16:00', '22:00', 1, 19)

  // History
  const pIntro1 = O('r1', 'intro', 'Any', -10, '15:00', '15:30', 4, 0)
  const pR1 = [-8, -7, -5, -4, -2].map((d) => O('r1', 'shift', 'Server', d, '17:00', '22:00', 2, 18))
  const pIntro2 = O('r2', 'intro', 'Any', -20, '15:00', '15:30', 3, 0)
  const pR2 = [-18, -15, -11, -6].map((d) => O('r2', 'shift', 'Server', d, '18:00', '22:00', 1, 17))
  const pIntro6 = O('r6', 'intro', 'Any', -14, '09:00', '09:30', 2, 0)
  const pR6 = O('r6', 'shift', 'Barista', -9, '07:00', '12:00', 1, 16.5)
  const pIntro3 = O('r3', 'intro', 'Any', -12, '09:00', '09:30', 2, 16)

  const bookings: Booking[] = []
  const quests: Quest[] = []
  let b = 0
  const B = (o: Opportunity, candidateId: string, status: Booking['status'], source: Booking['source'] = 'self') => {
    const bk: Booking = { id: `b${++b}`, oppId: o.id, candidateId, status, source, createdAt: iso(+new Date(o.start) - 2 * DAY), updatedAt: iso(+new Date(o.start) - DAY) }
    bookings.push(bk)
    if (status === 'pending' || status === 'confirmed' || status === 'attended' || status === 'no_show') o.filled++
    if (status === 'attended' && o.awardsPoint) quests.push({ id: `q${quests.length + 1}`, restaurantId: o.restaurantId, candidateId, bookingId: bk.id, kind: o.kind, at: o.end })
  }

  ;['c1', 'c2', 'c6'].forEach((c) => B(pIntro1, c, 'attended'))
  B(pR1[1], 'c1', 'attended')
  B(pR1[3], 'c1', 'attended')
  B(pR1[0], 'c6', 'attended')
  B(pR1[2], 'c6', 'attended')
  B(pR1[4], 'c6', 'attended')
  B(pR1[4], 'c2', 'no_show')
  B(pIntro2, 'c1', 'attended')
  pR2.forEach((o) => B(o, 'c1', 'attended'))
  B(pIntro6, 'c3', 'attended')
  B(pR6, 'c3', 'attended')
  B(pIntro3, 'c3', 'attended')

  B(g1, 'c1', 'confirmed')
  B(g2, 'c6', 'pending')
  B(p1, 'c4', 'confirmed')
  B(tShift, 'c6', 'confirmed')
  B(yShift, 'c2', 'confirmed')

  const E = (restaurantId: string, candidateId: string): Eligibility => ({ restaurantId, candidateId, eligible: true })
  const eligibility = [E('r1', 'c1'), E('r1', 'c2'), E('r1', 'c6'), E('r2', 'c1'), E('r6', 'c3'), E('r3', 'c3')]

  return {
    v: DB_VERSION,
    profiles: people,
    restaurants,
    members: [],
    codes: [
      { code: 'DEMO-NEW-1', restaurantId: null, maxUses: 1, uses: 0 },
      { code: 'DEMO-NEW-2', restaurantId: null, maxUses: 1, uses: 0 },
      { code: 'DEMO-NEW-3', restaurantId: null, maxUses: 1, uses: 0 },
      { code: 'DEMO-GORGE', restaurantId: 'r1', maxUses: 99, uses: 0 },
    ],
    opps,
    bookings,
    quests,
    eligibility,
    notes: [],
  }
}
