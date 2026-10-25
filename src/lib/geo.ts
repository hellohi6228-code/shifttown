/** Service area for the illustrated Ithaca map. Restaurants outside it are rejected. */
export const BOUNDS = { south: 42.415, north: 42.462, west: -76.53, east: -76.47 }

export const GW = 24
export const GH = 24
export const TW = 64
export const TH = 32

export const inBounds = (lat: number, lng: number) =>
  lat >= BOUNDS.south && lat <= BOUNDS.north && lng >= BOUNDS.west && lng <= BOUNDS.east

export const toGrid = (lat: number, lng: number) => ({
  gx: ((lng - BOUNDS.west) / (BOUNDS.east - BOUNDS.west)) * GW,
  gy: ((BOUNDS.north - lat) / (BOUNDS.north - BOUNDS.south)) * GH,
})

export const fromGrid = (gx: number, gy: number) => ({
  lat: BOUNDS.north - (gy / GH) * (BOUNDS.north - BOUNDS.south),
  lng: BOUNDS.west + (gx / GW) * (BOUNDS.east - BOUNDS.west),
})

/** Grid → isometric pixel position (origin at the map's top corner). */
export const iso = (gx: number, gy: number) => ({ x: ((gx - gy) * TW) / 2, y: ((gx + gy) * TH) / 2 })

/** Isometric pixel → grid (inverse of iso). */
export const unIso = (x: number, y: number) => ({ gx: y / TH + x / TW, gy: y / TH - x / TW })

/** Neighborhoods are the only location we store for candidates — never exact addresses. */
export const AREAS = [
  { id: 'downtown', name: 'Downtown', lat: 42.4396, lng: -76.4975 },
  { id: 'collegetown', name: 'Collegetown', lat: 42.442, lng: -76.4855 },
  { id: 'cornell', name: 'East Hill', lat: 42.4475, lng: -76.4825 },
  { id: 'fallcreek', name: 'Fall Creek', lat: 42.4495, lng: -76.4955 },
  { id: 'northside', name: 'Northside', lat: 42.4465, lng: -76.5035 },
  { id: 'southside', name: 'Southside', lat: 42.4345, lng: -76.501 },
  { id: 'southhill', name: 'South Hill', lat: 42.4235, lng: -76.4985 },
  { id: 'bellesherman', name: 'Belle Sherman', lat: 42.4375, lng: -76.479 },
  { id: 'westhill', name: 'West Hill', lat: 42.4435, lng: -76.5195 },
  { id: 'inlet', name: 'Inlet', lat: 42.4385, lng: -76.5115 },
] as const

export const area = (id: string) => AREAS.find((a) => a.id === id) ?? AREAS[0]

export function milesBetween(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 3958.8
  const toRad = (d: number) => (d * Math.PI) / 180
  const dLat = toRad(b.lat - a.lat)
  const dLng = toRad(b.lng - a.lng)
  const h = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(a.lat)) * Math.cos(toRad(b.lat)) * Math.sin(dLng / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(h))
}

/** Street distance is longer than a straight line; 1.3 is a common detour factor. */
export function travel(mi: number) {
  const street = mi * 1.3
  if (street <= 1.5) return { mi: street, mins: Math.max(2, Math.round((street / 3) * 60)), icon: '🚶' }
  return { mi: street, mins: Math.max(3, Math.round((street / 11) * 60 + 3)), icon: '🚌' }
}

export interface ParsedMapsUrl {
  ok: boolean
  short: boolean
  name?: string
  address?: string
  lat?: number
  lng?: number
}

/** Pulls the place name and pin from a Google Maps link. Short links (maps.app.goo.gl)
 *  can't be expanded in the browser, so those fall back to manual confirmation. */
export function parseMapsUrl(raw: string): ParsedMapsUrl {
  let url: URL
  try {
    url = new URL(raw.trim())
  } catch {
    return { ok: false, short: false }
  }
  const host = url.hostname.replace(/^www\./, '')
  const short = host === 'maps.app.goo.gl' || host === 'goo.gl'
  const isMaps =
    short ||
    host === 'maps.google.com' ||
    (/^google\.[a-z.]+$/.test(host) && url.pathname.startsWith('/maps'))
  if (!isMaps) return { ok: false, short: false }
  if (short) return { ok: true, short: true }

  const path = decodeURIComponent(url.pathname)
  const out: ParsedMapsUrl = { ok: true, short: false }
  const place = path.match(/\/place\/([^/]+)/)
  if (place) {
    const parts = place[1].replace(/\+/g, ' ').split(',').map((s) => s.trim())
    out.name = parts[0]
    if (parts.length > 1) out.address = parts.slice(1).join(', ')
  }
  const q = url.searchParams.get('q') ?? url.searchParams.get('query')
  if (!out.name && q && !/^-?\d/.test(q)) {
    const parts = q.split(',').map((s) => s.trim())
    out.name = parts[0]
    if (parts.length > 1) out.address = parts.slice(1).join(', ')
  }
  // !3d<lat>!4d<lng> is the place pin; @lat,lng is just the camera.
  const pin = raw.match(/!3d(-?\d+\.\d+)!4d(-?\d+\.\d+)/)
  const cam = path.match(/@(-?\d+\.\d+),(-?\d+\.\d+)/)
  const qll = (q ?? url.searchParams.get('ll') ?? '').match(/^(-?\d+\.\d+),\s*(-?\d+\.\d+)$/)
  const m = pin ?? cam ?? qll
  if (m) {
    out.lat = parseFloat(m[1])
    out.lng = parseFloat(m[2])
  }
  return out
}
