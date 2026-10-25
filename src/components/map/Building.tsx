import type { Restaurant } from '../../types'
import { toGrid } from '../../lib/geo'
import { box, onLeft, onRight, px, quad, tint } from './geometry'

export const BA = 0.62
export const BH = 44

export const buildingTop = (r: Pick<Restaurant, 'lat' | 'lng'>) => {
  const { gx, gy } = toGrid(r.lat, r.lng)
  const p = px(gx, gy)
  return { x: p.x, y: p.y - BH - 50 }
}

export const buildingBase = (r: Pick<Restaurant, 'lat' | 'lng'>) => {
  const { gx, gy } = toGrid(r.lat, r.lng)
  return px(gx + BA, gy + BA)
}

/** Where a visitor stands: just outside the front door. */
export const doorstep = (r: Pick<Restaurant, 'lat' | 'lng'>) => {
  const { gx, gy } = toGrid(r.lat, r.lng)
  return onLeft(gx, gy, BA, BA, 0.5, 0, 0.42)
}

export function Building({ r, state, selected, faded, onTap }: { r: Restaurant; state: 'new' | 'hiring' | 'none'; selected: boolean; faded: boolean; onTap: () => void }) {
  const { gx, gy } = toGrid(r.lat, r.lng)
  const a = BA
  const h = BH
  const f = box(gx, gy, a, a, h)
  const quiet = state === 'none'
  const roof = quiet ? '#D9D4E4' : r.color
  const L = (t: number, z: number, out = 0) => onLeft(gx, gy, a, a, t, z, out)
  const R = (t: number, z: number) => onRight(gx, gy, a, a, t, z)
  const stripes = 8
  const center = px(gx, gy)
  const signY = center.y - h - 26
  return (
    <g onClick={onTap} style={{ cursor: 'pointer', opacity: faded ? 0.35 : 1 }} role="button" aria-label={r.name}>
      {selected && (
        <ellipse cx={center.x} cy={center.y + 4} rx={a * 64 + 18} ry={a * 32 + 9} fill="none" stroke={r.color} strokeWidth="5" strokeDasharray="10 8" opacity="0.9">
          <animate attributeName="stroke-dashoffset" from="0" to="36" dur="1.2s" repeatCount="indefinite" />
        </ellipse>
      )}
      <polygon points={f.shadow} fill="rgba(58,53,80,0.14)" />
      <polygon points={f.left} fill={tint(r.color, 0.84)} />
      <polygon points={f.right} fill={tint(r.color, 0.66)} />
      {/* windows */}
      {[[0.08, 0.3], [0.7, 0.92]].map(([t0, t1]) => (
        <g key={t0}>
          <polygon points={quad([L(t0, 9), L(t1, 9), L(t1, 23), L(t0, 23)])} fill="#D9F1FF" stroke="#fff" strokeWidth="2" />
          <polygon points={quad([L(t0, 18), L(t1, 18), L(t1, 23), L(t0, 23)])} fill="#fff" opacity="0.45" />
        </g>
      ))}
      {[[0.14, 0.42], [0.58, 0.86]].map(([t0, t1]) => (
        <polygon key={t0} points={quad([R(t0, 12), R(t1, 12), R(t1, 26), R(t0, 26)])} fill="#C8E8FB" stroke="#fff" strokeWidth="2" />
      ))}
      {/* door */}
      <polygon points={quad([L(0.4, 0), L(0.6, 0), L(0.6, 22), L(0.4, 22)])} fill={quiet ? '#B9B2C9' : tint(r.color, 0.1)} />
      <circle cx={L(0.56, 11).x} cy={L(0.56, 11).y} r="1.6" fill="#fff" />
      {/* awning */}
      {Array.from({ length: stripes }, (_, i) => {
        const t0 = 0.02 + (i * 0.96) / stripes
        const t1 = t0 + 0.96 / stripes
        return <polygon key={i} points={quad([L(t0, 33), L(t1, 33), L(t1, 26, 0.18), L(t0, 26, 0.18)])} fill={i % 2 ? '#fff' : roof} />
      })}
      {/* roof */}
      <polygon points={f.top} fill={roof} />
      <polygon points={box(gx, gy, a - 0.1, a - 0.1, 0, h).top} fill={tint(roof.startsWith('#') ? roof : '#D9D4E4', 0.45)} />
      {/* sign */}
      <line x1={center.x} y1={center.y - h} x2={center.x} y2={signY + 12} stroke="#fff" strokeWidth="4" />
      <circle cx={center.x} cy={signY} r="18" fill="#fff" stroke={roof} strokeWidth="4" />
      <text x={center.x} y={signY + 1} fontSize="19" textAnchor="middle" dominantBaseline="central">
        {r.emoji}
      </text>
    </g>
  )
}
