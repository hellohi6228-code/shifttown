import type { Restaurant } from '../../types'
import { toGrid } from '../../lib/geo'
import { level } from '../../lib/rules'
import { box, onLeft, onRight, px, quad, tint } from './geometry'
import type { Spot } from './layout'

const spot = (r: Pick<Restaurant, 'lat' | 'lng'>, at?: Spot) => at ?? toGrid(r.lat, r.lng)

export const BA = 0.62

/** Buildings grow a little with the restaurant's level. */
export const heightOf = (r: Pick<Restaurant, 'xp'>) => 32 + 3 * Math.min(level(r.xp).lv, 7)

/** Centre of the round sign on the roof. */
export const signOf = (r: Pick<Restaurant, 'lat' | 'lng' | 'xp'>, at?: Spot) => {
  const { gx, gy } = spot(r, at)
  const p = px(gx, gy)
  return { x: p.x, y: p.y - heightOf(r) - 26 }
}

export const buildingBase = (r: Pick<Restaurant, 'lat' | 'lng'>, at?: Spot) => {
  const { gx, gy } = spot(r, at)
  return px(gx + BA, gy + BA)
}

/** Where a visitor stands: just outside the front door. */
export const doorstep = (r: Pick<Restaurant, 'lat' | 'lng'>, at?: Spot) => {
  const { gx, gy } = spot(r, at)
  return onLeft(gx, gy, BA, BA, 0.5, 0, 0.42)
}

const GREY = '#CFCAD9'

export function Building({ r, at, grey = false, selected = false, faded = false, onTap }: { r: Restaurant; at?: Spot; grey?: boolean; selected?: boolean; faded?: boolean; onTap?: () => void }) {
  const { gx, gy } = spot(r, at)
  const a = BA
  const h = heightOf(r)
  const lv = level(r.xp).lv
  const f = box(gx, gy, a, a, h)
  const color = grey ? GREY : r.color
  const L = (t: number, z: number, out = 0) => onLeft(gx, gy, a, a, t, z, out)
  const R = (t: number, z: number) => onRight(gx, gy, a, a, t, z)
  const stripes = 8
  const center = px(gx, gy)
  const signY = center.y - h - 26
  return (
    <g onClick={onTap} style={{ cursor: onTap ? 'pointer' : undefined, opacity: faded ? 0.35 : 1, transition: 'opacity 0.2s' }} role={onTap ? 'button' : undefined} aria-label={r.name}>
      {selected && (
        <ellipse cx={center.x} cy={center.y + 4} rx={a * 64 + 18} ry={a * 32 + 9} fill="none" stroke={grey ? '#B3ADC2' : r.color} strokeWidth="5" strokeDasharray="10 8" opacity="0.9">
          <animate attributeName="stroke-dashoffset" from="0" to="36" dur="1.2s" repeatCount="indefinite" />
        </ellipse>
      )}
      <polygon points={f.shadow} fill="rgba(58,53,80,0.14)" />
      <polygon points={f.left} fill={grey ? '#F1EFF5' : tint(r.color, 0.84)} />
      <polygon points={f.right} fill={grey ? '#E2DEEA' : tint(r.color, 0.66)} />
      {[[0.08, 0.3], [0.7, 0.92]].map(([t0, t1]) => (
        <g key={t0}>
          <polygon points={quad([L(t0, 9), L(t1, 9), L(t1, 23), L(t0, 23)])} fill={grey ? '#E6E3EE' : '#D9F1FF'} stroke="#fff" strokeWidth="2" />
          <polygon points={quad([L(t0, 18), L(t1, 18), L(t1, 23), L(t0, 23)])} fill="#fff" opacity="0.45" />
        </g>
      ))}
      {[[0.14, 0.42], [0.58, 0.86]].map(([t0, t1]) => (
        <polygon key={t0} points={quad([R(t0, 12), R(t1, 12), R(t1, 26), R(t0, 26)])} fill={grey ? '#DDD9E6' : '#C8E8FB'} stroke="#fff" strokeWidth="2" />
      ))}
      <polygon points={quad([L(0.4, 0), L(0.6, 0), L(0.6, 22), L(0.4, 22)])} fill={grey ? '#B9B2C9' : tint(r.color, 0.1)} />
      <circle cx={L(0.56, 11).x} cy={L(0.56, 11).y} r="1.6" fill="#fff" />
      {Array.from({ length: stripes }, (_, i) => {
        const t0 = 0.02 + (i * 0.96) / stripes
        const t1 = t0 + 0.96 / stripes
        return <polygon key={i} points={quad([L(t0, 33), L(t1, 33), L(t1, 26, 0.18), L(t0, 26, 0.18)])} fill={i % 2 ? '#fff' : color} />
      })}
      <polygon points={f.top} fill={color} />
      <polygon points={box(gx, gy, a - 0.1, a - 0.1, 0, h).top} fill={tint(color, 0.45)} />
      {lv >= 3 && (
        <g>
          <line x1={px(gx + 0.35, gy - 0.35).x} y1={px(gx + 0.35, gy - 0.35).y - h} x2={px(gx + 0.35, gy - 0.35).x} y2={px(gx + 0.35, gy - 0.35).y - h - 24} stroke="#fff" strokeWidth="2.5" />
          <path d={`M${px(gx + 0.35, gy - 0.35).x} ${px(gx + 0.35, gy - 0.35).y - h - 24} l14 5 l-14 5 Z`} fill={grey ? '#B3ADC2' : '#FFD25A'} />
        </g>
      )}
      <line x1={center.x} y1={center.y - h} x2={center.x} y2={signY + 12} stroke="#fff" strokeWidth="4" />
      <circle cx={center.x} cy={signY} r="18" fill="#fff" stroke={color} strokeWidth="4" />
      <text x={center.x} y={signY + 1} fontSize="19" textAnchor="middle" dominantBaseline="central" style={{ filter: grey ? 'grayscale(0.85)' : undefined }}>
        {r.emoji}
      </text>
    </g>
  )
}
