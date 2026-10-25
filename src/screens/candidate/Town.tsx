import { useMemo, useState } from 'react'
import type { Restaurant } from '../../types'
import { useStore } from '../../store'
import { check, isOpen, level, pointsAt, restaurantState } from '../../lib/rules'
import { Avatar } from '../../components/Avatar'
import { Bell } from '../../components/Overlays'
import { RestaurantSheet } from '../../components/RestaurantSheet'
import { TownMap } from '../../components/TownMap'
import { Chip, Icon, Pill } from '../../components/ui'

type Filter = 'all' | 'meet' | 'shift' | 'forme'

export function Town({ onMe, onBell, selected, onSelect }: { onMe: () => void; onBell: () => void; selected: string | null; onSelect: (id: string | null) => void }) {
  const { snap, motion, api } = useStore()
  const me = snap.me!
  const [filter, setFilter] = useState<Filter>('all')
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const now = Date.now()

  const states = useMemo(() => Object.fromEntries(snap.restaurants.map((r) => [r.id, restaurantState(r, snap.opps, now)])), [snap, now])
  const points = useMemo(() => Object.fromEntries(snap.restaurants.map((r) => [r.id, pointsAt(snap, r.id, me.id)])), [snap, me.id])

  const faded = useMemo(() => {
    const out = new Set<string>()
    const needle = q.trim().toLowerCase()
    snap.restaurants.forEach((r) => {
      const open = snap.opps.filter((o) => o.restaurantId === r.id && isOpen(o, now))
      const text = `${r.name} ${r.cuisine} ${open.map((o) => o.role).join(' ')}`.toLowerCase()
      let keep = !needle || text.includes(needle)
      if (filter === 'meet') keep &&= open.some((o) => o.kind !== 'shift')
      if (filter === 'shift') keep &&= open.some((o) => o.kind === 'shift')
      if (filter === 'forme') keep &&= open.some((o) => check(me, o, r, snap, now).ok)
      if (!keep) out.add(r.id)
    })
    return out
  }, [snap, q, filter, me, now])

  const lv = level(snap.quests.filter((x) => x.candidateId === me.id).length)
  const sel: Restaurant | null = snap.restaurants.find((r) => r.id === selected) ?? null

  return (
    <div className="relative h-full">
      <TownMap
        restaurants={snap.restaurants}
        states={states}
        faded={faded}
        points={points}
        selectedId={selected}
        onSelect={(r) => onSelect(r.id)}
        player={{ look: me.look, area: me.area }}
        motion={motion}
      />
      <div className="pt-safe pointer-events-none absolute inset-x-0 top-0 z-10 px-3">
        <div className="flex items-center justify-between gap-2">
          <button onClick={onMe} className="pointer-events-auto flex items-center gap-2 rounded-full bg-white py-1 pr-3.5 pl-1 shadow-soft active:scale-95">
            <span className="relative">
              <span className="block overflow-hidden rounded-full bg-pink-soft">
                <Avatar look={me.look} head size={42} anim="none" />
              </span>
              <span className="absolute -right-1 -bottom-1 rounded-full bg-sun px-1.5 text-[11px] leading-[18px] font-extrabold text-ink ring-2 ring-white">{lv.lv}</span>
            </span>
            <span className="max-w-28 truncate text-[17px] font-extrabold">{me.name}</span>
          </button>
          <div className="pointer-events-auto flex items-center gap-2">
            {api.mode === 'demo' && <Pill className="bg-lav-soft text-lav-deep">DEMO</Pill>}
            <Bell onOpen={onBell} />
          </div>
        </div>
        <div className="no-scrollbar pointer-events-auto -mx-3 mt-2.5 flex gap-2 overflow-x-auto px-3 pb-2">
          {searching ? (
            <div className="flex h-10 min-w-56 items-center gap-1 rounded-full border-2 border-pink bg-white pr-1 pl-3">
              <Icon.search size={18} />
              <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pizza, barista…" className="w-full bg-transparent text-[16px] font-semibold outline-none" />
              <button onClick={() => (setQ(''), setSearching(false))} aria-label="Clear" className="p-1 text-muted">
                <Icon.x size={18} />
              </button>
            </div>
          ) : (
            <button onClick={() => setSearching(true)} aria-label="Search" className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border-2 border-line bg-white">
              <Icon.search size={20} />
            </button>
          )}
          {(
            [
              ['forme', '✨ For me', 'pink'],
              ['meet', '👋 Intro', 'sky'],
              ['shift', '🍳 Shifts', 'mint'],
            ] as const
          ).map(([id, label, tone]) => (
            <Chip key={id} tone={tone} on={filter === id} onClick={() => setFilter(filter === id ? 'all' : id)} className="shadow-soft">
              {label}
            </Chip>
          ))}
        </div>
      </div>
      <RestaurantSheet r={sel} onClose={() => onSelect(null)} />
    </div>
  )
}
