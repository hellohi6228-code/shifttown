import type { Restaurant } from '../../types'
import { GH, GW, toGrid } from '../../lib/geo'
import { distToPolyline, inPolygon, type G } from './geometry'
import { CAMPUS, COMMONS, CREEKS, IC, LAKE, LANDMARK_SPOTS, ROADS } from './Scene'

export type Spot = { gx: number; gy: number }

/** Buildable lots: beside the streets, never on a road, in water or on a landmark. */
const LOTS: G[] = (() => {
  const out: G[] = []
  for (let x = 1; x <= GW - 1; x += 0.25)
    for (let y = 1; y <= GH - 1; y += 0.25) {
      const g: G = [x, y]
      if (inPolygon(g, LAKE) || inPolygon(g, CAMPUS) || inPolygon(g, IC) || inPolygon(g, COMMONS)) continue
      if (ROADS.some((r) => distToPolyline(g, r) < 1)) continue
      if (CREEKS.some((c) => distToPolyline(g, c.pts) < 0.75 + c.w / 40)) continue
      if (LANDMARK_SPOTS.some(([a, b]) => Math.hypot(x - a, y - b) < 1.4)) continue
      out.push(g)
    }
  return out
})()

const GAP = 2.3

/** Real storefronts are often meters apart, which is less than one building on
 *  this map. Each store takes the free lot nearest its real Google Maps pin. */
export function layoutStores(rs: Restaurant[]): Map<string, Spot> {
  const placed: { id: string; g: G }[] = []
  for (const r of rs) {
    const t = toGrid(r.lat, r.lng)
    let best: G | null = null
    let bd = Infinity
    for (const lot of LOTS) {
      const d = (lot[0] - t.gx) ** 2 + (lot[1] - t.gy) ** 2
      if (d >= bd || placed.some((p) => Math.hypot(p.g[0] - lot[0], p.g[1] - lot[1]) < GAP)) continue
      best = lot
      bd = d
    }
    placed.push({ id: r.id, g: best ?? [t.gx, t.gy] })
  }
  return new Map(placed.map((p) => [p.id, { gx: p.g[0], gy: p.g[1] }]))
}
