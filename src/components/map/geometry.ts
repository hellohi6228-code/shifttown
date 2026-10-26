import { GH, GW, iso } from '../../lib/geo'

/** Map canvas in map pixels; grid (0,0) sits at (OX, OY). The town fills a
 *  diamond in the middle; countryside, lake and roads run out to every edge. */
export const OX = 1000
export const OY = 420
export const MAP_W = 2000
export const MAP_H = 1600

export type G = [number, number]

export const px = (gx: number, gy: number) => {
  const p = iso(gx, gy)
  return { x: p.x + OX, y: p.y + OY }
}

export const pts = (arr: G[], lift = 0) =>
  arr
    .map(([a, b]) => {
      const p = px(a, b)
      return `${p.x.toFixed(1)},${(p.y - lift).toFixed(1)}`
    })
    .join(' ')

export const line = (arr: G[]) =>
  'M' +
  arr
    .map(([a, b]) => {
      const p = px(a, b)
      return `${p.x.toFixed(1)} ${p.y.toFixed(1)}`
    })
    .join(' L')

/** Catmull-Rom through grid points → smooth SVG path in map pixels. */
export function smooth(arr: G[], closed = false) {
  const p = arr.map(([a, b]) => px(a, b))
  const n = p.length
  const at = (i: number) => (closed ? p[(i + n) % n] : p[Math.max(0, Math.min(n - 1, i))])
  let d = `M${p[0].x.toFixed(1)} ${p[0].y.toFixed(1)}`
  const segs = closed ? n : n - 1
  for (let i = 0; i < segs; i++) {
    const p0 = at(i - 1)
    const p1 = at(i)
    const p2 = at(i + 1)
    const p3 = at(i + 2)
    const c1 = { x: p1.x + (p2.x - p0.x) / 6, y: p1.y + (p2.y - p0.y) / 6 }
    const c2 = { x: p2.x - (p3.x - p1.x) / 6, y: p2.y - (p3.y - p1.y) / 6 }
    d += ` C${c1.x.toFixed(1)} ${c1.y.toFixed(1)} ${c2.x.toFixed(1)} ${c2.y.toFixed(1)} ${p2.x.toFixed(1)} ${p2.y.toFixed(1)}`
  }
  return closed ? d + 'Z' : d
}

export function distToPolyline([x, y]: G, poly: G[]) {
  let best = Infinity
  for (let i = 0; i < poly.length - 1; i++) {
    const [ax, ay] = poly[i]
    const [bx, by] = poly[i + 1]
    const dx = bx - ax
    const dy = by - ay
    const t = Math.max(0, Math.min(1, ((x - ax) * dx + (y - ay) * dy) / (dx * dx + dy * dy || 1)))
    best = Math.min(best, Math.hypot(x - (ax + t * dx), y - (ay + t * dy)))
  }
  return best
}

export function inPolygon([x, y]: G, poly: G[]) {
  let inside = false
  for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
    const [xi, yi] = poly[i]
    const [xj, yj] = poly[j]
    if (yi > y !== yj > y && x < ((xj - xi) * (y - yi)) / (yj - yi) + xi) inside = !inside
  }
  return inside
}

export const rect = (x0: number, y0: number, x1: number, y1: number): G[] => [
  [x0, y0],
  [x1, y0],
  [x1, y1],
  [x0, y1],
]

export const inside = (gx: number, gy: number) => gx >= 0 && gy >= 0 && gx <= GW && gy <= GH

/** Mix a hex color toward white (t=1 → white). */
export function tint(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16)
  const m = (c: number) => Math.round(c + (255 - c) * t)
  return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`
}

export function darken(hex: string, t: number) {
  const n = parseInt(hex.slice(1), 16)
  const m = (c: number) => Math.round(c * (1 - t))
  return `rgb(${m(n >> 16)},${m((n >> 8) & 255)},${m(n & 255)})`
}

/** An extruded iso box: returns the visible faces as polygon point strings. */
export function box(cx: number, cy: number, a: number, b: number, h: number, lift = 0) {
  const N: G = [cx - a, cy - b]
  const E: G = [cx + a, cy - b]
  const S: G = [cx + a, cy + b]
  const W: G = [cx - a, cy + b]
  return {
    left: pts([W, S], lift) + ' ' + pts([S, W], lift + h),
    right: pts([S, E], lift) + ' ' + pts([E, S], lift + h),
    top: pts([N, E, S, W], lift + h),
    shadow: pts([[cx - a, cy - b + 0.12], [cx + a + 0.25, cy - b + 0.12], [cx + a + 0.25, cy + b + 0.3], [cx - a, cy + b + 0.3]]),
  }
}

/** Point on the front-left face: t along the face (0 = left end), z = height in px. */
export function onLeft(cx: number, cy: number, a: number, b: number, t: number, z: number, out = 0) {
  const p = px(cx - a + 2 * a * t, cy + b + out)
  return { x: p.x, y: p.y - z }
}

/** Point on the front-right face: t along the face (0 = front corner), z = height. */
export function onRight(cx: number, cy: number, a: number, b: number, t: number, z: number) {
  const p = px(cx + a, cy + b - 2 * b * t)
  return { x: p.x, y: p.y - z }
}

export const quad = (p: { x: number; y: number }[]) => p.map((q) => `${q.x.toFixed(1)},${q.y.toFixed(1)}`).join(' ')

export function mulberry(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}
