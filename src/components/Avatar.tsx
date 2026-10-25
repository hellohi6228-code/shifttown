import type { Look } from '../types'
import { HAIR_COLORS, OUTFIT_COLORS, SKIN } from '../lib/look'

const INK = '#2E2A3A'

function shade(hex: string, amt: number) {
  const n = parseInt(hex.slice(1), 16)
  const c = (v: number) => Math.max(0, Math.min(255, Math.round(v + amt)))
  return `rgb(${c(n >> 16)},${c((n >> 8) & 255)},${c(n & 255)})`
}

function HairBack({ style, color }: { style: number; color: string }) {
  if (style === 1) return <path d="M21 40 Q20 11 50 11 Q80 11 79 40 L80 62 Q72 67 69 57 L31 57 Q28 67 20 62 Z" fill={color} />
  if (style === 2) return <path d="M20 40 Q18 9 50 10 Q82 9 80 40 L83 88 Q67 95 64 80 L36 80 Q33 95 17 88 Z" fill={color} />
  if (style === 3) return <circle cx="50" cy="10" r="10.5" fill={color} />
  if (style === 4)
    return (
      <g fill={color}>
        {[[25, 36], [30, 22], [41, 14], [54, 12], [66, 17], [74, 28], [77, 41], [23, 47], [78, 50]].map(([x, y], i) => (
          <circle key={i} cx={x} cy={y} r="10" />
        ))}
      </g>
    )
  return null
}

function HairFront({ style, color }: { style: number; color: string }) {
  switch (style) {
    case 0:
      return <path d="M23 42 Q21 13 50 12 Q79 13 77 42 Q71 30 63 28 Q56 35 46 30 Q36 35 30 30 Q25 35 23 42 Z" fill={color} />
    case 1:
      return <path d="M23 41 Q23 15 50 14 Q77 15 77 41 Q72 28 62 27 Q50 31 38 27 Q28 28 23 41 Z" fill={color} />
    case 2:
      return <path d="M23 42 Q21 13 50 12 Q79 13 77 42 Q74 29 66 25 Q52 36 33 30 Q26 34 23 42 Z" fill={color} />
    case 3:
      return <path d="M23 40 Q22 15 50 14 Q78 15 77 40 Q70 26 50 26 Q30 26 23 40 Z" fill={color} />
    case 4:
      return <path d="M23 40 Q23 18 50 17 Q77 18 77 40 Q66 29 50 31 Q34 29 23 40 Z" fill={color} />
    case 5:
      return <path d="M22 42 L23 24 L30 28 L33 11 L41 22 L48 6 L55 21 L63 9 L66 25 L75 17 L76 30 L80 36 L77 42 Q66 30 50 30 Q34 30 22 42 Z" fill={color} />
    default:
      return <path d="M24 37 Q26 14 50 13 Q74 14 76 37 Q64 25 50 25 Q36 25 24 37 Z" fill={color} opacity="0.9" />
  }
}

function Outfit({ outfit, color }: { outfit: number; color: string }) {
  const body = 'M30 74 Q30 65 41 64 L59 64 Q70 65 70 74 L71 98 Q71 103 66 103 L34 103 Q29 103 29 98 Z'
  if (outfit === 1)
    return (
      <g>
        <path d={body} fill="#FFF6E8" />
        <path d="M36 76 L64 76 L66 103 L34 103 Z" fill={color} />
        <path d="M37 77 L41 65 M63 77 L59 65" stroke={color} strokeWidth="3" strokeLinecap="round" />
        <rect x="44" y="84" width="12" height="8" rx="2" fill={shade(color === '#FFFFFF' ? '#EEEAF4' : color, -25)} />
      </g>
    )
  if (outfit === 2)
    return (
      <g>
        <path d={body} fill={color} />
        <path d="M35 67 Q50 79 65 67 Q62 61 50 61 Q38 61 35 67 Z" fill={shade(color, -28)} />
        <path d="M46 72 L45 82 M54 72 L55 82" stroke="#fff" strokeWidth="1.8" strokeLinecap="round" />
        <path d="M38 90 Q50 86 62 90 L62 100 L38 100 Z" fill={shade(color, -18)} />
      </g>
    )
  if (outfit === 3)
    return (
      <g>
        <path d={body} fill="#FFFFFF" stroke="#E4DFEE" strokeWidth="1.5" />
        <path d="M42 64 L50 74 L58 64 Z" fill={color} />
        {[78, 86, 94].map((y) => (
          <g key={y} fill="#CFC9DD">
            <circle cx="44" cy={y} r="1.6" />
            <circle cx="56" cy={y} r="1.6" />
          </g>
        ))}
      </g>
    )
  return (
    <g>
      <path d={body} fill={color} />
      <path d="M43 65 Q50 71 57 65" stroke={shade(color, -35)} strokeWidth="2" fill="none" strokeLinecap="round" />
    </g>
  )
}

function Accessory({ acc, accent }: { acc: number; accent: string }) {
  switch (acc) {
    case 1:
      return (
        <g stroke={INK} strokeWidth="2" fill="rgba(255,255,255,0.25)">
          <circle cx="40" cy="45" r="6.5" />
          <circle cx="60" cy="45" r="6.5" />
          <path d="M46.5 45 L53.5 45" fill="none" />
        </g>
      )
    case 2:
      return (
        <g>
          <path d="M23 36 Q25 10 50 10 Q75 10 77 36 Z" fill={accent} />
          <path d="M52 33 Q78 29 92 37 Q80 42 60 38 Z" fill={shade(accent, -30)} />
          <circle cx="50" cy="11" r="3" fill={shade(accent, -30)} />
        </g>
      )
    case 3:
      return (
        <g>
          <path d="M22 33 Q50 19 78 33 L78 39 Q50 26 22 39 Z" fill="#FF6B8B" />
          {[32, 44, 56, 68].map((x) => (
            <circle key={x} cx={x} cy={x === 32 || x === 68 ? 33 : 29} r="1.4" fill="#fff" />
          ))}
        </g>
      )
    case 4:
      return (
        <g fill="#FF6B9A">
          <path d="M68 20 L59 12 L59 28 Z" />
          <path d="M68 20 L77 12 L77 28 Z" />
          <circle cx="68" cy="20" r="3.4" fill="#FF4F86" />
        </g>
      )
    case 5:
      return (
        <g>
          <path d="M21 42 Q20 6 50 6 Q80 6 79 42" stroke="#4A4560" strokeWidth="4" fill="none" />
          <rect x="15" y="36" width="10" height="15" rx="4.5" fill="#6EC6FF" />
          <rect x="75" y="36" width="10" height="15" rx="4.5" fill="#6EC6FF" />
        </g>
      )
    case 6:
      return (
        <g>
          <path d="M31 22 Q22 6 37 5 Q41 -4 50 0 Q59 -4 63 5 Q78 6 69 22 Z" fill="#fff" stroke="#E4DFEE" strokeWidth="1.5" />
          <rect x="30" y="17" width="40" height="9" rx="3" fill="#fff" stroke="#E4DFEE" strokeWidth="1.5" />
        </g>
      )
    default:
      return null
  }
}

/** The character drawn in a 100×128 box (y from -8). Usable inside any SVG. */
export function Figure({ look, wave }: { look: Look; wave?: boolean }) {
  const skin = SKIN[look.skin] ?? SKIN[0]
  const hair = HAIR_COLORS[look.hairColor] ?? HAIR_COLORS[0]
  const color = OUTFIT_COLORS[look.outfitColor] ?? OUTFIT_COLORS[0]
  const sleeve = look.outfit === 1 ? '#FFF6E8' : look.outfit === 3 ? '#FFFFFF' : color
  const accent = color === '#FFFFFF' ? '#FF8FB1' : shade(color, -10)
  const hatHidesHair = look.acc === 2 || look.acc === 6
  return (
    <g>
      <ellipse cx="50" cy="114" rx="21" ry="4.5" fill="rgba(58,53,80,0.13)" />
      <g className="av-body">
        <HairBack style={look.hair} color={hair} />
        <rect x="39" y="97" width="9" height="14" rx="4" fill="#4A4560" />
        <rect x="52" y="97" width="9" height="14" rx="4" fill="#4A4560" />
        <ellipse cx="43" cy="111" rx="6" ry="3.4" fill="#2E2A3A" />
        <ellipse cx="57" cy="111" rx="6" ry="3.4" fill="#2E2A3A" />
        <g>
          <path d="M33 71 L26 91" stroke={sleeve} strokeWidth="9" strokeLinecap="round" />
          <circle cx="25.5" cy="93" r="5" fill={skin} />
        </g>
        <Outfit outfit={look.outfit} color={color} />
        <g className={wave ? 'av-arm-wave' : 'av-arm'}>
          <path d="M67 71 L74 91" stroke={sleeve} strokeWidth="9" strokeLinecap="round" />
          <circle cx="74.5" cy="93" r="5" fill={skin} />
        </g>
        <rect x="45" y="58" width="10" height="9" rx="3" fill={skin} />
        <circle cx="23.5" cy="44" r="5" fill={skin} />
        <circle cx="76.5" cy="44" r="5" fill={skin} />
        <circle cx="50" cy="40" r="27" fill={skin} />
        <g className="av-eyes">
          <ellipse cx="40" cy="45" rx="3.6" ry="4.6" fill={INK} />
          <ellipse cx="60" cy="45" rx="3.6" ry="4.6" fill={INK} />
          <circle cx="41.3" cy="43.2" r="1.3" fill="#fff" />
          <circle cx="61.3" cy="43.2" r="1.3" fill="#fff" />
        </g>
        <ellipse cx="33" cy="53" rx="4.6" ry="2.6" fill="#FF8FB1" opacity="0.45" />
        <ellipse cx="67" cy="53" rx="4.6" ry="2.6" fill="#FF8FB1" opacity="0.45" />
        <path d="M45 54 Q50 59 55 54" stroke={INK} strokeWidth="2" fill="none" strokeLinecap="round" />
        {!hatHidesHair || look.hair === 2 || look.hair === 1 ? <HairFront style={look.hair} color={hair} /> : null}
        <Accessory acc={look.acc} accent={accent} />
      </g>
    </g>
  )
}

export function Avatar({
  look,
  size = 64,
  anim = 'idle',
  head = false,
  body = false,
  className = '',
}: {
  look: Look
  size?: number
  anim?: 'idle' | 'wave' | 'jump' | 'walk' | 'none'
  head?: boolean
  body?: boolean
  className?: string
}) {
  return (
    <svg
      viewBox={head ? '14 -6 72 72' : body ? '16 58 68 50' : '0 -8 100 128'}
      width={size}
      height={head ? size : body ? (size * 50) / 68 : size * 1.28}
      className={`avatar av-${anim} ${className}`}
      aria-hidden
    >
      <Figure look={look} wave={anim === 'wave' || anim === 'jump'} />
    </svg>
  )
}
