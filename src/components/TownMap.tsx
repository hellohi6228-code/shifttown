import { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import type { Look, Restaurant } from '../types'
import { area, toGrid } from '../lib/geo'
import { Figure } from './Avatar'
import { Building, buildingBase, buildingTop, doorstep } from './map/Building'
import { DECOS, DISTRICTS, Scene, WALK_PATHS } from './map/Scene'
import { MAP_H, MAP_W, px } from './map/geometry'

type State = 'new' | 'hiring' | 'none'

const TOWNSFOLK: Look[] = [
  { skin: 1, hair: 0, hairColor: 2, outfit: 0, outfitColor: 3, acc: 0 },
  { skin: 3, hair: 3, hairColor: 0, outfit: 1, outfitColor: 0, acc: 0 },
  { skin: 0, hair: 2, hairColor: 3, outfit: 2, outfitColor: 4, acc: 5 },
  { skin: 4, hair: 4, hairColor: 0, outfit: 0, outfitColor: 2, acc: 2 },
  { skin: 2, hair: 1, hairColor: 1, outfit: 3, outfitColor: 1, acc: 0 },
  { skin: 5, hair: 6, hairColor: 0, outfit: 2, outfitColor: 5, acc: 1 },
]

const clamp = (v: number, a: number, b: number) => Math.max(a, Math.min(b, v))
const MIN_S = 0.3
const MAX_S = 2.2

export interface MapPlayer {
  look: Look
  area: string
}

export function TownMap({
  restaurants, states, faded, points, selectedId, onSelect, player, motion, labels = true,
}: {
  restaurants: Restaurant[]
  states: Record<string, State>
  faded?: Set<string>
  points?: Record<string, number>
  selectedId?: string | null
  onSelect: (r: Restaurant) => void
  player?: MapPlayer | null
  motion: boolean
  labels?: boolean
}) {
  const outer = useRef<HTMLDivElement>(null)
  const inner = useRef<HTMLDivElement>(null)
  const view = useRef({ x: 0, y: 0, s: 0.6 })
  const drag = useRef({ moved: false, touched: false })

  const apply = useCallback((animate = false) => {
    const el = inner.current
    const box = outer.current
    if (!el || !box) return
    const v = view.current
    const vw = box.clientWidth
    const vh = box.clientHeight
    v.s = clamp(v.s, MIN_S, MAX_S)
    v.x = clamp(v.x, vw * 0.5 - MAP_W * v.s, vw * 0.5)
    v.y = clamp(v.y, vh * 0.45 - MAP_H * v.s, vh * 0.45)
    el.style.transition = animate ? 'transform 0.45s cubic-bezier(0.3, 0.8, 0.3, 1)' : 'none'
    el.style.transform = `translate3d(${v.x}px, ${v.y}px, 0) scale(${v.s})`
    el.style.setProperty('--inv', String(clamp(1 / v.s, 0.7, 1.15)))
    el.dataset.zoom = v.s >= 0.95 ? 'near' : 'far'
  }, [])

  const centerOn = useCallback(
    (mx: number, my: number, s: number | null, yFrac = 0.5, animate = true) => {
      const box = outer.current
      if (!box) return
      const v = view.current
      if (s) v.s = s
      v.x = box.clientWidth / 2 - mx * v.s
      v.y = box.clientHeight * yFrac - my * v.s
      apply(animate)
    },
    [apply],
  )

  // Initial camera: the player's neighborhood, or downtown.
  useLayoutEffect(() => {
    const box = outer.current
    if (!box) return
    const home = () => {
      const a = area(player?.area ?? 'downtown')
      const g = toGrid(a.lat, a.lng)
      const p = px(g.gx, g.gy)
      centerOn(p.x, p.y - 40, clamp(box.clientWidth / 520, 0.6, 1.1), 0.5, false)
    }
    home()
    const ro = new ResizeObserver(() => (drag.current.touched ? apply() : home()))
    ro.observe(box)
    return () => ro.disconnect()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // Bring the chosen restaurant into the top part of the screen (the sheet covers the bottom).
  useEffect(() => {
    if (!selectedId) return
    const r = restaurants.find((x) => x.id === selectedId)
    if (!r) return
    const g = toGrid(r.lat, r.lng)
    const p = px(g.gx, g.gy)
    centerOn(p.x, p.y - 30, Math.max(view.current.s, 0.75), 0.24)
  }, [selectedId, restaurants, centerOn])

  // Pan, pinch and wheel zoom.
  useEffect(() => {
    const box = outer.current
    if (!box) return
    const pointers = new Map<number, { x: number; y: number }>()
    let start = { x: 0, y: 0, vx: 0, vy: 0, dist: 0, s: 1, mx: 0, my: 0 }
    const snapshot = () => {
      const ps = [...pointers.values()]
      const v = view.current
      const mid = ps.length === 2 ? { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 } : ps[0]
      start = {
        x: mid.x, y: mid.y, vx: v.x, vy: v.y, s: v.s,
        dist: ps.length === 2 ? Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y) : 0,
        mx: (mid.x - v.x) / v.s, my: (mid.y - v.y) / v.s,
      }
    }
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      const ps = [...pointers.values()]
      const v = view.current
      if (ps.length === 1) {
        const dx = ps[0].x - start.x
        const dy = ps[0].y - start.y
        if (Math.hypot(dx, dy) > 7) drag.current.moved = true
        v.x = start.vx + dx
        v.y = start.vy + dy
      } else if (ps.length === 2) {
        drag.current.moved = true
        const mid = { x: (ps[0].x + ps[1].x) / 2, y: (ps[0].y + ps[1].y) / 2 }
        const dist = Math.hypot(ps[0].x - ps[1].x, ps[0].y - ps[1].y)
        v.s = clamp((start.s * dist) / (start.dist || 1), MIN_S, MAX_S)
        v.x = mid.x - start.mx * v.s
        v.y = mid.y - start.my * v.s
      }
      apply()
    }
    const up = (e: PointerEvent) => {
      pointers.delete(e.pointerId)
      if (pointers.size) snapshot()
      else {
        window.removeEventListener('pointermove', move)
        window.removeEventListener('pointerup', up)
        window.removeEventListener('pointercancel', up)
      }
    }
    const down = (e: PointerEvent) => {
      if (e.button > 0) return
      drag.current.touched = true
      if (!pointers.size) {
        drag.current.moved = false
        window.addEventListener('pointermove', move)
        window.addEventListener('pointerup', up)
        window.addEventListener('pointercancel', up)
      }
      pointers.set(e.pointerId, { x: e.clientX, y: e.clientY })
      snapshot()
    }
    const wheel = (e: WheelEvent) => {
      drag.current.touched = true
      e.preventDefault()
      const v = view.current
      const rect = box.getBoundingClientRect()
      const cx = e.clientX - rect.left
      const cy = e.clientY - rect.top
      const mx = (cx - v.x) / v.s
      const my = (cy - v.y) / v.s
      v.s = clamp(v.s * Math.exp(-e.deltaY * 0.0016), MIN_S, MAX_S)
      v.x = cx - mx * v.s
      v.y = cy - my * v.s
      apply()
    }
    // Clicks that ended a drag shouldn't open a restaurant.
    const click = (e: MouseEvent) => {
      if (drag.current.moved) {
        e.stopPropagation()
        e.preventDefault()
      }
    }
    box.addEventListener('pointerdown', down)
    box.addEventListener('wheel', wheel, { passive: false })
    box.addEventListener('click', click, true)
    return () => {
      box.removeEventListener('pointerdown', down)
      box.removeEventListener('wheel', wheel)
      box.removeEventListener('click', click, true)
      window.removeEventListener('pointermove', move)
      window.removeEventListener('pointerup', up)
      window.removeEventListener('pointercancel', up)
    }
  }, [apply])

  // Keep scenery clear of restaurants added later.
  const decos = useMemo(() => {
    const spots = restaurants.map((r) => toGrid(r.lat, r.lng))
    return DECOS.filter((d) => spots.every((s) => Math.hypot(d.g[0] - s.gx, d.g[1] - s.gy) > 1.15))
  }, [restaurants])

  const ordered = useMemo(() => [...restaurants].sort((a, b) => {
    const ga = toGrid(a.lat, a.lng)
    const gb = toGrid(b.lat, b.lng)
    return ga.gx + ga.gy - (gb.gx + gb.gy)
  }), [restaurants])

  // The player's avatar walks to the chosen restaurant.
  const home = useMemo(() => {
    const a = area(player?.area ?? 'downtown')
    const g = toGrid(a.lat, a.lng)
    return px(g.gx + 0.4, g.gy + 0.4)
  }, [player?.area])
  const selected = restaurants.find((r) => r.id === selectedId)
  const target = selected ? doorstep(selected) : home
  const [walking, setWalking] = useState(false)
  const [greet, setGreet] = useState(true)
  useEffect(() => {
    setWalking(true)
    const t = setTimeout(() => setWalking(false), 950)
    return () => clearTimeout(t)
  }, [target.x, target.y])
  useEffect(() => {
    const t = setTimeout(() => setGreet(false), 2600)
    return () => clearTimeout(t)
  }, [])

  const PS = 0.32
  return (
    <div ref={outer} className="absolute inset-0 touch-none overflow-hidden" style={{ background: 'radial-gradient(circle at 30% 20%, #FFF0F5 0, transparent 45%), radial-gradient(circle at 80% 70%, #E6F6FF 0, transparent 50%), #FFFDF7' }}>
      <div ref={inner} className="absolute top-0 left-0 origin-top-left will-change-transform" style={{ width: MAP_W, height: MAP_H }}>
        <svg width={MAP_W} height={MAP_H} viewBox={`0 0 ${MAP_W} ${MAP_H}`} className="block">
          <Scene decos={decos} />
          {motion &&
            TOWNSFOLK.map((look, i) => (
              <g key={i}>
                <g transform={`translate(${-50 * 0.24} ${-112 * 0.24}) scale(0.24)`}>
                  <g className="avatar av-walk">
                    <Figure look={look} />
                  </g>
                </g>
                <animateMotion dur={`${44 + i * 9}s`} repeatCount="indefinite" keyPoints="0;1;0" keyTimes="0;0.5;1" calcMode="linear" begin={`${-i * 7}s`} path={WALK_PATHS[i % WALK_PATHS.length]} />
              </g>
            ))}
          {ordered.map((r) => (
            <Building key={r.id} r={r} state={states[r.id] ?? 'none'} selected={r.id === selectedId} faded={!!faded?.has(r.id)} onTap={() => onSelect(r)} />
          ))}
          {player && (
            <g className="map-walk" style={{ transform: `translate(${target.x}px, ${target.y}px)` }}>
              <ellipse cx="0" cy="2" rx="20" ry="7" fill="#FF8FB1" opacity="0.25" />
              <g transform={`translate(${-50 * PS} ${-112 * PS}) scale(${PS})`}>
                <g className={`avatar ${walking ? 'av-walk' : greet ? 'av-idle' : 'av-idle'}`}>
                  <Figure look={player.look} wave={greet && !walking} />
                </g>
              </g>
            </g>
          )}
        </svg>
        {labels && (
          <div className="pointer-events-none absolute inset-0">
            {DISTRICTS.map((d) => {
              const p = px(d.at[0], d.at[1])
              return (
                <div key={d.name} className="absolute origin-bottom" style={{ left: p.x, top: p.y, transform: 'translate(-50%, -50%) scale(var(--inv))' }}>
                  <span className="rounded-full bg-white/70 px-2 py-0.5 text-[12px] font-bold whitespace-nowrap text-ink/55">
                    {d.icon} {d.name}
                  </span>
                </div>
              )
            })}
            {ordered.map((r) => {
              const top = buildingTop(r)
              const base = buildingBase(r)
              const st = states[r.id] ?? 'none'
              const pts = points?.[r.id] ?? 0
              const dim = faded?.has(r.id)
              return (
                <div key={r.id} style={{ opacity: dim ? 0.35 : 1 }}>
                  {st !== 'none' && (
                    <button
                      className="pointer-events-auto absolute origin-bottom"
                      style={{ left: top.x, top: top.y, transform: 'translate(-50%, -100%) scale(var(--inv))' }}
                      onClick={() => onSelect(r)}
                      aria-label={`${r.name} hiring`}
                    >
                      {st === 'new' ? (
                        <span className="anim-wiggle inline-block rounded-full bg-sun px-2 py-0.5 text-[13px] font-extrabold text-ink shadow-pop">NEW</span>
                      ) : (
                        <span className="anim-float inline-flex h-7 w-7 items-center justify-center rounded-full bg-mint text-lg font-extrabold text-white shadow-pop">!</span>
                      )}
                    </button>
                  )}
                  <button
                    className={`map-name pointer-events-auto absolute origin-top ${r.id === selectedId ? "is-sel" : ""}`}
                    style={{ left: base.x - 26, top: base.y + 2, transform: 'translate(-50%, 0) scale(var(--inv))' }}
                    onClick={() => onSelect(r)}
                  >
                    <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] font-bold whitespace-nowrap shadow-soft ${r.id === selectedId ? 'bg-ink text-white' : 'bg-white text-ink'}`}>
                      {r.name}
                      {pts > 0 && <span className="text-sun-deep">⭐{pts}</span>}
                    </span>
                  </button>
                </div>
              )
            })}
            {player && greet && motion && (
              <div className="anim-pop absolute origin-bottom" style={{ left: home.x, top: home.y - 52, transform: 'translate(-50%, -100%) scale(var(--inv))' }}>
                <span className="rounded-2xl bg-white px-2.5 py-1 text-sm font-extrabold shadow-soft">Hi! 👋</span>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  )
}
