import { useMemo, useState } from 'react'
import type { Restaurant } from '../../types'
import { useStore } from '../../store'
import { canCheckIn, canCheckOut, isOpen, level, oppOf, pointsAt, storeFor, title } from '../../lib/rules'
import { fmtTimeRange } from '../../lib/time'
import { Avatar } from '../../components/Avatar'
import { Bell } from '../../components/Overlays'
import { RestaurantSheet } from '../../components/RestaurantSheet'
import { TownMap } from '../../components/TownMap'
import { Btn, Icon, Pill } from '../../components/ui'

/** Shows up on the map when it's time to check in or out. */
function NowCard({ onPlace }: { onPlace: (id: string) => void }) {
  const { snap, act, api, busy } = useStore()
  const me = snap.me!
  const item = snap.bookings
    .filter((b) => b.candidateId === me.id)
    .map((b) => ({ b, o: oppOf(snap, b)! }))
    .filter((x) => x.o)
    .map((x) => ({ ...x, in: canCheckIn(x.o, x.b, 'candidate'), out: canCheckOut(x.o, x.b, 'candidate') }))
    .filter((x) => x.in || x.out)
    .sort((a, b) => +new Date(a.o.start) - +new Date(b.o.start))[0]
  if (!item) return null
  const r = snap.restaurants.find((x) => x.id === item.o.restaurantId)!
  const key = `now-${item.b.id}`
  return (
    <div className="anim-pop pointer-events-auto mt-2 flex items-center gap-3 rounded-3xl bg-white p-2.5 pl-3.5 shadow-lift">
      <button onClick={() => onPlace(r.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="text-3xl">{r.emoji}</span>
        <span className="min-w-0">
          <span className="block truncate font-extrabold">{r.name}</span>
          <span className="block truncate text-[14px] font-semibold text-muted">
            {title(item.o)} · {fmtTimeRange(item.o.start, item.o.end)}
          </span>
        </span>
      </button>
      {item.in ? (
        <Btn tone="mint" loading={busy === key} onClick={() => act(key, () => api.checkIn(item.b.id), 'Checked in 🟢')}>
          Check in
        </Btn>
      ) : (
        <Btn tone="pink" loading={busy === key} onClick={() => act(key, () => api.checkOut(item.b.id))}>
          Check out
        </Btn>
      )}
    </div>
  )
}

export function Town({ onMe, onBell, selected, onSelect }: { onMe: () => void; onBell: () => void; selected: string | null; onSelect: (id: string | null) => void }) {
  const { snap, motion, api } = useStore()
  const me = snap.me!
  const [q, setQ] = useState('')
  const [searching, setSearching] = useState(false)
  const now = Date.now()

  const { grey, marks, points } = useMemo(() => {
    const grey = new Set<string>()
    const marks = new Set<string>()
    const points: Record<string, number> = {}
    snap.restaurants.forEach((r) => {
      const s = storeFor(me, r, snap, now)
      if (!s.unlocked) grey.add(r.id)
      if (s.bookable) marks.add(r.id)
      points[r.id] = pointsAt(snap, r.id, me.id)
    })
    return { grey, marks, points }
  }, [snap, me, now])

  const faded = useMemo(() => {
    const needle = q.trim().toLowerCase()
    const out = new Set<string>()
    if (!needle) return out
    snap.restaurants.forEach((r) => {
      const roles = snap.opps.filter((o) => o.restaurantId === r.id && isOpen(o, now)).map((o) => o.role)
      if (!`${r.name} ${r.cuisine} ${roles.join(' ')}`.toLowerCase().includes(needle)) out.add(r.id)
    })
    return out
  }, [snap, q, now])

  const lv = level(snap.quests.filter((x) => x.candidateId === me.id).length)
  const sel: Restaurant | null = snap.restaurants.find((r) => r.id === selected) ?? null

  return (
    <div className="relative h-full">
      <TownMap restaurants={snap.restaurants} grey={grey} marks={marks} faded={faded} points={points} selectedId={selected} onSelect={(r) => onSelect(r.id)} player={{ look: me.look, area: me.area }} motion={motion} />
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
            {searching ? null : (
              <button onClick={() => setSearching(true)} aria-label="Search" className="flex h-12 w-12 items-center justify-center rounded-full bg-white shadow-soft active:scale-95">
                <Icon.search />
              </button>
            )}
            <Bell onOpen={onBell} />
          </div>
        </div>
        {searching && (
          <div className="pointer-events-auto mt-2 flex h-12 items-center gap-1 rounded-full border-2 border-pink bg-white pr-1 pl-4 shadow-soft">
            <Icon.search size={18} />
            <input autoFocus value={q} onChange={(e) => setQ(e.target.value)} placeholder="Pizza, barista…" className="w-full bg-transparent text-[16px] font-semibold outline-none" />
            <button onClick={() => (setQ(''), setSearching(false))} aria-label="Close search" className="p-2 text-muted">
              <Icon.x size={18} />
            </button>
          </div>
        )}
        <NowCard onPlace={onSelect} />
      </div>
      <RestaurantSheet r={sel} onClose={() => onSelect(null)} />
    </div>
  )
}
