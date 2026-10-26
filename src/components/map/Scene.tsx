// Illustrated, Ithaca-inspired terrain: Cayuga Lake, the Inlet, the gorges,
// the Commons, East Hill (Cornell) and South Hill (Ithaca College).
import { memo } from 'react'
import { GH, GW } from '../../lib/geo'
import { box, distToPolyline, inPolygon, line, MAP_H, MAP_W, mulberry, onLeft, onRight, OX, OY, px, pts, quad, rect, smooth, type G } from './geometry'

/** Cayuga Lake runs north off the top of the map. */
export const LAKE: G[] = [[0.2, -30], [14.5, -30], [16.2, -14], [16, -6], [15.4, -0.2], [15.2, 1.6], [14.4, 3.1], [12.6, 3.9], [10.2, 4.3], [8.2, 4.3], [6.9, 3.9], [5.6, 3.1], [4.3, 1.8], [3.2, 0.7], [2.2, -6], [1.2, -14]]
export const CREEKS: { pts: G[]; w: number }[] = [
  { pts: [[6.7, 4], [6.5, 6.5], [6.6, 9.5], [7, 12.5], [7.6, 15], [8.2, 17.5], [8.6, 30], [9.4, 50]], w: 20 },
  { pts: [[50, 3.5], [36, 4.2], [24.3, 5.3], [21.5, 5.6], [18.6, 6.1], [16.8, 6.1], [15.3, 5.8], [14.3, 5.2], [13.8, 4.2], [13.6, 3.6]], w: 11 },
  { pts: [[50, 8], [36, 8.6], [24.3, 9.2], [21, 8.9], [18.8, 8.7], [16.6, 9.0], [14.6, 9.2], [12, 8.8], [9.6, 8.3], [7.6, 7.9], [6.6, 7.9]], w: 8 },
  { pts: [[50, 22], [36, 19.5], [24.3, 17.4], [21.5, 16.6], [18.5, 15.8], [15.8, 15.3], [13.2, 15.0], [10.8, 14.1], [8.8, 13.2], [7.1, 12.7]], w: 10 },
]
export const ROADS: G[][] = [
  [[-30, 10.2], [0, 10.9], [4, 11.4], [9.6, 11.4], [12.4, 11.4]],
  [[14.8, 11.4], [16.2, 11.4], [17.9, 10.6], [24, 10.4], [50, 9.8]],
  [[10, 4.8], [9.6, 7], [9.6, 24], [9.2, 50]],
  [[13.2, 4.4], [13.2, 19], [14.1, 24], [15.4, 50]],
  [[17.9, 6.6], [17.9, 14.5]],
  [[13.2, 8], [15.8, 7.4], [18.8, 6.8], [22.8, 6.9], [50, 6.4]],
  [[17.9, 12.7], [24, 12.9], [50, 14]],
  [[9.6, 17.6], [13.2, 17.6]],
  [[-30, 5.6], [0, 6.6], [3.2, 7.2], [6.6, 7.4], [9.6, 7]],
  [[13.2, 4.4], [16.9, 0.8], [17.6, -14], [18.2, -32]],
  [[6.6, 7.4], [2.6, 4.4], [-0.6, -6], [-1.8, -32]],
]
/** The Commons pedestrian mall (State St between Cayuga and Aurora). */
export const COMMONS: G[] = rect(12.4, 10.85, 14.8, 11.95)
export const CAMPUS: G[] = [[18.6, 2.8], [24, 2.8], [24, 8.2], [19.4, 8.3], [18.6, 7.2]]
export const IC: G[] = [[12.2, 20.4], [17.6, 20.2], [17.8, 24], [12.6, 24]]
const DOWNTOWN: G[] = rect(10.1, 9.6, 16.6, 13.6)

/** Is this grid point on the drawn canvas? */
const onCanvas = ([gx, gy]: G, pad = 20) => {
  const p = px(gx, gy)
  return p.x > pad && p.x < MAP_W - pad && p.y > pad && p.y < MAP_H - pad
}

export const LANDMARK_SPOTS: G[] = [[20.4, 5.4], [19.2, 4.1], [21.9, 4.4], [22.2, 6.5], [14.9, 21.6], [16, 22.6], [8.6, 5.4], [6.9, 3.9], [13.6, 11.4], [15.3, 5.9]]

export interface Deco {
  kind: 'house' | 'tree' | 'pine' | 'bloom'
  g: G
  v: number
}

/** Houses and trees scattered deterministically where nothing else is. */
export const DECOS: Deco[] = (() => {
  const rnd = mulberry(42)
  const out: Deco[] = []
  const busy = (g: G, pad: number) =>
    inPolygon(g, LAKE) ||
    CREEKS.some((c) => distToPolyline(g, c.pts) < pad + c.w / 40) ||
    ROADS.some((r) => distToPolyline(g, r) < pad + 0.35) ||
    inPolygon(g, CAMPUS) ||
    inPolygon(g, IC) ||
    inPolygon(g, COMMONS) ||
    LANDMARK_SPOTS.some(([x, y]) => Math.hypot(g[0] - x, g[1] - y) < 1.3)
  for (let x = 0.6; x < GW - 0.3; x += 1) {
    for (let y = 0.6; y < GH - 0.3; y += 1) {
      const g: G = [x + (rnd() - 0.5) * 0.3, y + (rnd() - 0.5) * 0.3]
      const r = rnd()
      const town = inPolygon(g, DOWNTOWN) || (g[0] > 8 && g[0] < 19 && g[1] > 5 && g[1] < 19)
      if (busy(g, 0.45)) {
        if (!inPolygon(g, LAKE) && !inPolygon(g, CAMPUS) && !inPolygon(g, IC) && !busy(g, 0.15) && r < 0.12) out.push({ kind: 'tree', g, v: rnd() })
        continue
      }
      if (r < (town ? 0.62 : 0.32)) out.push({ kind: 'house', g, v: rnd() })
      else if (r < (town ? 0.8 : 0.78)) out.push({ kind: rnd() < 0.2 ? 'bloom' : rnd() < 0.5 ? 'pine' : 'tree', g, v: rnd() })
    }
  }
  // Countryside out to the edges: mostly trees, a few farmhouses.
  for (let x = -26; x < 50; x += 1.3) {
    for (let y = -30; y < 50; y += 1.3) {
      if (x > -0.5 && x < GW + 0.5 && y > -0.5 && y < GH + 0.5) continue
      const g: G = [x + (rnd() - 0.5) * 0.6, y + (rnd() - 0.5) * 0.6]
      const r = rnd()
      if (!onCanvas(g) || busy(g, 0.4) || r > 0.34) continue
      out.push({ kind: r < 0.04 ? 'house' : rnd() < 0.45 ? 'pine' : rnd() < 0.15 ? 'bloom' : 'tree', g, v: rnd() })
    }
  }
  // Campus and park trees
  for (let i = 0; i < 26; i++) {
    const g: G = [18.8 + rnd() * 5, 3 + rnd() * 5]
    if (inPolygon(g, CAMPUS) && !LANDMARK_SPOTS.some(([x, y]) => Math.hypot(g[0] - x, g[1] - y) < 1) && distToPolyline(g, ROADS[5]) > 0.4)
      out.push({ kind: rnd() < 0.3 ? 'bloom' : 'tree', g, v: rnd() })
  }
  for (let i = 0; i < 18; i++) {
    const g: G = [12.4 + rnd() * 5.2, 20.6 + rnd() * 3.2]
    if (inPolygon(g, IC) && !LANDMARK_SPOTS.some(([x, y]) => Math.hypot(g[0] - x, g[1] - y) < 0.9) && distToPolyline(g, ROADS[3]) > 0.4) out.push({ kind: 'pine', g, v: rnd() })
  }
  return out.sort((a, b) => a.g[0] + a.g[1] - (b.g[0] + b.g[1]))
})()

const WALLS = ['#FFF3E0', '#FFE6EE', '#E3F3FF', '#FFF6D2', '#E6F8EC', '#F1EAFF']
const ROOFS = ['#FF9FB8', '#7CC4F2', '#F4BE4C', '#73CBA2', '#B19AF2', '#FFA27A']

export function House({ g, v }: { g: G; v: number }) {
  const [cx, cy] = g
  const a = 0.3
  const b = 0.26
  const h = 15 + Math.round(v * 6)
  const rh = 12
  const wall = WALLS[Math.floor(v * 97) % WALLS.length]
  const roof = ROOFS[Math.floor(v * 61) % ROOFS.length]
  const f = box(cx, cy, a, b, h)
  const W = px(cx - a, cy + b)
  const S = px(cx + a, cy + b)
  const E = px(cx + a, cy - b)
  const N = px(cx - a, cy - b)
  const r1 = px(cx - a, cy)
  const r2 = px(cx + a, cy)
  const R1 = { x: r1.x, y: r1.y - h - rh }
  const R2 = { x: r2.x, y: r2.y - h - rh }
  const up = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - h })
  return (
    <g>
      <polygon points={f.shadow} fill="rgba(58,53,80,0.08)" />
      <polygon points={quad([up(N), up(E), R2, R1])} fill={roof} />
      <polygon points={f.left} fill={wall} />
      <polygon points={f.right} fill={wall} style={{ filter: 'brightness(0.93)' }} />
      <polygon points={quad([up(S), up(E), R2])} fill={wall} style={{ filter: 'brightness(0.88)' }} />
      <polygon points={quad([up(W), up(S), R2, R1])} fill={roof} />
      <polygon points={quad([up(W), up(S), R2, R1])} fill="#fff" opacity="0.18" />
      <polygon points={quad([onLeft(cx, cy, a, b, 0.4, 0), onLeft(cx, cy, a, b, 0.62, 0), onLeft(cx, cy, a, b, 0.62, 10), onLeft(cx, cy, a, b, 0.4, 10)])} fill="#C9A27E" />
      <polygon points={quad([onRight(cx, cy, a, b, 0.3, 7), onRight(cx, cy, a, b, 0.7, 7), onRight(cx, cy, a, b, 0.7, 12), onRight(cx, cy, a, b, 0.3, 12)])} fill="#CDEBFF" />
    </g>
  )
}

export function Tree({ g, v, kind }: { g: G; v: number; kind: Deco['kind'] }) {
  const p = px(g[0], g[1])
  const s = 0.85 + v * 0.4
  if (kind === 'pine')
    return (
      <g transform={`translate(${p.x} ${p.y}) scale(${s})`}>
        <ellipse cx="2" cy="1" rx="9" ry="4" fill="rgba(58,53,80,0.1)" />
        <rect x="-2" y="-8" width="4" height="8" rx="1.5" fill="#B98A5E" />
        <path d="M0 -36 L11 -14 L-11 -14 Z" fill="#5DBB88" />
        <path d="M0 -28 L13 -6 L-13 -6 Z" fill="#4FAE7B" />
        <path d="M0 -36 L-11 -14 L0 -14 Z" fill="#fff" opacity="0.15" />
      </g>
    )
  const crown = kind === 'bloom' ? ['#FFB7CC', '#FF9DBA'] : v > 0.5 ? ['#86D7A0', '#6CC68C'] : ['#9BDFA4', '#7CCF93']
  return (
    <g transform={`translate(${p.x} ${p.y}) scale(${s})`}>
      <ellipse cx="2" cy="1" rx="11" ry="4.5" fill="rgba(58,53,80,0.1)" />
      <rect x="-2.2" y="-10" width="4.4" height="10" rx="2" fill="#B98A5E" />
      <circle cx="0" cy="-20" r="12" fill={crown[1]} />
      <circle cx="-3" cy="-23" r="9" fill={crown[0]} />
      <circle cx="-5" cy="-26" r="3" fill="#fff" opacity="0.35" />
    </g>
  )
}

function Hall({ g, a, b, h, roof = '#9AA9C4' }: { g: G; a: number; b: number; h: number; roof?: string }) {
  const [cx, cy] = g
  const f = box(cx, cy, a, b, h)
  const rh = 14
  const up = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - h })
  const N = px(cx - a, cy - b)
  const E = px(cx + a, cy - b)
  const S = px(cx + a, cy + b)
  const W = px(cx - a, cy + b)
  const R1 = { x: px(cx - a, cy).x, y: px(cx - a, cy).y - h - rh }
  const R2 = { x: px(cx + a, cy).x, y: px(cx + a, cy).y - h - rh }
  return (
    <g>
      <polygon points={f.shadow} fill="rgba(58,53,80,0.1)" />
      <polygon points={quad([up(N), up(E), R2, R1])} fill={roof} />
      <polygon points={f.left} fill="#F1E7D6" />
      <polygon points={f.right} fill="#E0D2BB" />
      <polygon points={quad([up(S), up(E), R2])} fill="#D6C6AC" />
      <polygon points={quad([up(W), up(S), R2, R1])} fill={roof} />
      {[0.2, 0.4, 0.6, 0.8].map((t) => {
        const p = { x: W.x + (S.x - W.x) * t, y: W.y + (S.y - W.y) * t - h * 0.55 }
        return <rect key={t} x={p.x - 3} y={p.y - 5} width="6" height="9" rx="2" fill="#BFE3FF" />
      })}
    </g>
  )
}

function Tower({ g, h, wall = '#F1E7D6', side = '#DCCDB4', roof = '#8C98B3', clock = true }: { g: G; h: number; wall?: string; side?: string; roof?: string; clock?: boolean }) {
  const [cx, cy] = g
  const a = 0.3
  const f = box(cx, cy, a, a, h)
  const top = px(cx, cy)
  const W = px(cx - a, cy + a)
  const S = px(cx + a, cy + a)
  const E = px(cx + a, cy - a)
  const N = px(cx - a, cy - a)
  const apex = { x: top.x, y: top.y - h - 34 }
  const up = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - h })
  const mid = { x: (W.x + S.x) / 2, y: (W.y + S.y) / 2 - h + 18 }
  return (
    <g>
      <polygon points={f.shadow} fill="rgba(58,53,80,0.12)" />
      <polygon points={f.left} fill={wall} />
      <polygon points={f.right} fill={side} />
      <polygon points={quad([up(N), up(E), apex])} fill={roof} />
      <polygon points={quad([up(E), up(S), apex])} fill={roof} style={{ filter: 'brightness(0.85)' }} />
      <polygon points={quad([up(W), up(S), apex])} fill={roof} />
      {clock ? (
        <g>
          <circle cx={mid.x} cy={mid.y} r="6.5" fill="#fff" stroke="#C9B48F" strokeWidth="1.5" />
          <path d={`M${mid.x} ${mid.y} L${mid.x} ${mid.y - 4} M${mid.x} ${mid.y} L${mid.x + 3} ${mid.y + 1}`} stroke="#3A3550" strokeWidth="1.3" strokeLinecap="round" />
        </g>
      ) : (
        [0.25, 0.5, 0.75].map((t) =>
          [0.2, 0.4, 0.6, 0.8].map((z) => (
            <rect key={`${t}${z}`} x={W.x + (S.x - W.x) * t - 2.5} y={W.y + (S.y - W.y) * t - h * z - 4} width="5" height="6" rx="1" fill="#CBE8FF" />
          )),
        )
      )}
    </g>
  )
}

function Pavilion({ g }: { g: G }) {
  const [cx, cy] = g
  const a = 1.1
  const b = 0.42
  const h = 12
  const W = px(cx - a, cy + b)
  const S = px(cx + a, cy + b)
  const E = px(cx + a, cy - b)
  const N = px(cx - a, cy - b)
  const R1 = { x: px(cx - a, cy).x, y: px(cx - a, cy).y - h - 14 }
  const R2 = { x: px(cx + a, cy).x, y: px(cx + a, cy).y - h - 14 }
  const up = (p: { x: number; y: number }) => ({ x: p.x, y: p.y - h })
  return (
    <g>
      <polygon points={box(cx, cy, a, b, 0).shadow} fill="rgba(58,53,80,0.1)" />
      {[0, 0.33, 0.66, 1].map((t) => (
        <line key={t} x1={W.x + (S.x - W.x) * t} y1={W.y + (S.y - W.y) * t} x2={W.x + (S.x - W.x) * t} y2={W.y + (S.y - W.y) * t - h} stroke="#B98A5E" strokeWidth="3" />
      ))}
      <polygon points={quad([up(N), up(E), R2, R1])} fill="#E86F6F" />
      <polygon points={quad([up(S), up(E), R2])} fill="#FFE4C9" />
      <polygon points={quad([up(W), up(S), R2, R1])} fill="#FF8C8C" />
      {[0.15, 0.4, 0.65, 0.9].map((t) => (
        <circle key={t} cx={W.x + (S.x - W.x) * t} cy={W.y + (S.y - W.y) * t - 2} r="3.5" fill={['#FFD25A', '#FF8FB1', '#5CC49E', '#FFB38A'][Math.round(t * 3)]} />
      ))}
    </g>
  )
}

function Lighthouse({ g }: { g: G }) {
  const p = px(g[0], g[1])
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <ellipse cx="3" cy="1" rx="10" ry="4" fill="rgba(58,53,80,0.12)" />
      <path d="M-6 0 L-4 -40 L4 -40 L6 0 Z" fill="#fff" />
      <path d="M-5.5 -10 L5.5 -10 L5 -18 L-5 -18 Z M-4.6 -26 L4.6 -26 L4.3 -33 L-4.3 -33 Z" fill="#FF7A8A" />
      <rect x="-5" y="-48" width="10" height="8" rx="2" fill="#FFE27A" />
      <path d="M-7 -48 L0 -56 L7 -48 Z" fill="#FF7A8A" />
    </g>
  )
}

function Boat({ g, c }: { g: G; c: string }) {
  const p = px(g[0], g[1])
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <g className="anim-float" style={{ transformBox: 'fill-box' }}>
        <path d="M-14 0 L14 0 L9 7 L-9 7 Z" fill="#fff" />
        <path d="M0 -2 L0 -30 L15 -4 Z" fill={c} />
        <path d="M-2 -4 L-2 -24 L-12 -4 Z" fill="#fff" opacity="0.9" />
      </g>
      <path d="M-18 9 Q-12 6 -6 9 M6 10 Q12 7 18 10" stroke="#fff" strokeWidth="2" fill="none" strokeLinecap="round" opacity="0.8" />
    </g>
  )
}

function Falls() {
  const top = px(15.6, 5.95)
  return (
    <g transform={`translate(${top.x} ${top.y})`}>
      <path d="M-26 -22 L18 -30 L22 -6 L-22 4 Z" fill="#C9C2D6" />
      <path d="M-26 -22 L18 -30 L14 -34 L-26 -28 Z" fill="#B3AACB" />
      {[-16, -8, 0, 8].map((x, i) => (
        <path key={x} d={`M${x} ${-26 + i * -1.5} L${x + 1} ${2 - i * 2}`} stroke="#fff" strokeWidth="4" strokeLinecap="round" opacity="0.9" />
      ))}
      <ellipse cx="-2" cy="5" rx="20" ry="5" fill="#fff" opacity="0.7" />
    </g>
  )
}

function Fountain() {
  const p = px(13.6, 11.4)
  return (
    <g transform={`translate(${p.x} ${p.y})`}>
      <ellipse cx="0" cy="0" rx="16" ry="8" fill="#CBEFFF" stroke="#fff" strokeWidth="3" />
      <rect x="-2" y="-12" width="4" height="12" fill="#fff" />
      <path d="M0 -12 Q-7 -20 -10 -6 M0 -12 Q7 -20 10 -6" stroke="#9FDFFF" strokeWidth="2.5" fill="none" strokeLinecap="round" />
    </g>
  )
}

/** Static terrain + scenery. Rendered once. */
export const Scene = memo(function Scene({ decos }: { decos: Deco[] }) {
  return (
    <g>
      {/* grass tiles, edge to edge (one iso checker pattern) */}
      <defs>
        <pattern id="st-tiles" width="64" height="32" patternUnits="userSpaceOnUse" x={(OX - 32) % 64} y={OY % 32}>
          <rect width="64" height="32" fill="#CDF1D8" />
          <polygon points="32,0 64,16 32,32 0,16" fill="#C2ECCF" />
        </pattern>
      </defs>
      <rect width={MAP_W} height={MAP_H} fill="url(#st-tiles)" />
      {/* districts */}
      <polygon points={pts(CAMPUS)} fill="#DDF6D2" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
      <polygon points={pts(IC)} fill="#DDF6D2" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
      <polygon points={pts(DOWNTOWN)} fill="#FFF7E9" stroke="#fff" strokeWidth="4" strokeLinejoin="round" />
      {/* water */}
      <path d={smooth(LAKE, true)} fill="#A6DEFF" stroke="#E2F5FF" strokeWidth="6" />
      {[[6.2, 1.2], [11, 0.9], [12.5, 2.6], [8.8, 2.9], [7, -6], [11.5, -9], [5, -14], [10, -18]].map(([x, y], i) => {
        const p = px(x, y)
        return <path key={i} d={`M${p.x - 12} ${p.y} q6 -5 12 0 q6 5 12 0`} stroke="#fff" strokeWidth="2.5" fill="none" strokeLinecap="round" opacity="0.8" />
      })}
      {CREEKS.map((c, i) => (
        <g key={i}>
          <path d={smooth(c.pts)} stroke="#E2F5FF" strokeWidth={c.w + 6} fill="none" strokeLinecap="round" strokeLinejoin="round" />
          <path d={smooth(c.pts)} stroke="#A6DEFF" strokeWidth={c.w} fill="none" strokeLinecap="round" strokeLinejoin="round" />
        </g>
      ))}
      {/* roads */}
      {ROADS.map((r, i) => (
        <path key={`e${i}`} d={line(r)} stroke="#DCD5E8" strokeWidth="27" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {ROADS.map((r, i) => (
        <path key={`r${i}`} d={line(r)} stroke="#F2EEF7" strokeWidth="22" fill="none" strokeLinecap="round" strokeLinejoin="round" />
      ))}
      {ROADS.map((r, i) => (
        <path key={`d${i}`} d={line(r)} stroke="#FFD86E" strokeWidth="2.2" strokeDasharray="9 11" fill="none" />
      ))}
      {/* the Commons */}
      <polygon points={pts(COMMONS)} fill="#FFD7E3" stroke="#fff" strokeWidth="3" strokeLinejoin="round" />
      {[12.8, 13.2, 14.0, 14.4].map((x) => (
        <path key={x} d={line([[x, 10.95], [x, 11.85]])} stroke="#fff" strokeWidth="1.5" opacity="0.7" />
      ))}
      <Fountain />
      <Falls />
      <Boat g={[8.4, 1.6]} c="#FF8FB1" />
      <Boat g={[12.2, 1.2]} c="#FFD25A" />
      <Lighthouse g={[6.9, 3.9]} />
      <Pavilion g={[8.6, 5.4]} />
      <Hall g={[19.2, 4.1]} a={0.8} b={0.42} h={30} />
      <Hall g={[21.9, 4.4]} a={0.5} b={0.85} h={34} />
      <Hall g={[22.2, 6.6]} a={0.85} b={0.42} h={28} roof="#A4B3CC" />
      <Tower g={[20.4, 5.4]} h={112} />
      <Tower g={[14.9, 21.6]} h={86} wall="#FAFAFD" side="#E3E3EE" roof="#C4CDE0" clock={false} />
      <Tower g={[16, 22.6]} h={86} wall="#FAFAFD" side="#E3E3EE" roof="#C4CDE0" clock={false} />
      {decos.map((d, i) => (d.kind === 'house' ? <House key={i} g={d.g} v={d.v} /> : <Tree key={i} g={d.g} v={d.v} kind={d.kind} />))}
    </g>
  )
})

/** Walking paths for ambient townsfolk (decorative). */
export const WALK_PATHS = [ROADS[0], ROADS[3], ROADS[4], ROADS[5], ROADS[2], ROADS[6]].map((r) => line(r))
