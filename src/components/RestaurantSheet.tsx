import type { Restaurant } from '../types'
import { useStore } from '../store'
import { area, milesBetween, toGrid, travel } from '../lib/geo'
import { bookingFor, isOpen, pointsAt, unlocked } from '../lib/rules'
import { Building } from './map/Building'
import { px } from './map/geometry'
import { OppCard } from './OppCard'
import { Empty, Sheet } from './ui'

export function MiniBuilding({ r, grey = false, size = 84 }: { r: Restaurant; grey?: boolean; size?: number }) {
  const g = toGrid(r.lat, r.lng)
  const c = px(g.gx, g.gy)
  return (
    <svg viewBox={`${c.x - 60} ${c.y - 124} 120 152`} width={size} height={(size * 152) / 120} aria-hidden className="shrink-0">
      <Building r={r} grey={grey} />
    </svg>
  )
}

/** A store: grey with its training slots until training is done, then color with its shifts. */
export function RestaurantSheet({ r, onClose }: { r: Restaurant | null; onClose: () => void }) {
  const { snap } = useStore()
  const me = snap.me
  if (!r || !me) return <Sheet open={false} onClose={onClose}>{null}</Sheet>
  const open = unlocked(snap, r.id, me.id)
  const t = travel(milesBetween(area(me.area), r))
  const pts = pointsAt(snap, r.id, me.id)
  const now = Date.now()
  const list = snap.opps
    .filter((o) => o.restaurantId === r.id && o.kind === (open ? 'shift' : 'training') && !o.cancelled && +new Date(o.end) > now)
    .filter((o) => isOpen(o, now) || bookingFor(snap, o.id, me.id))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))

  return (
    <Sheet open onClose={onClose}>
      <div className="flex items-end gap-3 pt-1">
        <MiniBuilding r={r} grey={!open} />
        <div className="min-w-0 flex-1 pb-2">
          <h2 className="truncate text-2xl leading-tight font-extrabold">{r.name}</h2>
          <div className="text-[15px] font-semibold text-muted">
            {r.emoji} {r.cuisine} · {t.icon} {t.mins} min
          </div>
          <a href={r.mapsUrl} target="_blank" rel="noreferrer" className="block truncate text-[14px] font-semibold text-sky-deep">
            📍 {r.address}
          </a>
          {r.demo && <div className="text-[12px] font-semibold text-muted">Openings are demo data</div>}
        </div>
        <div className="mb-2 flex flex-col items-center gap-0.5">
          <span className="text-2xl">{open ? '🔓' : '🔒'}</span>
          {pts > 0 && <span className="text-lg leading-none font-extrabold text-sun-deep">⭐{pts}</span>}
        </div>
      </div>
      <section className="mt-3 mb-4">
        <h3 className="mb-2 px-1 text-lg font-extrabold">{open ? '🍳 Shifts' : '🎓 Training'}</h3>
        <div className="flex flex-col gap-2.5">
          {list.length ? list.map((o) => <OppCard key={o.id} o={o} r={r} />) : <Empty icon="😴" text={open ? 'No shifts now' : 'No training slots now'} />}
        </div>
      </section>
    </Sheet>
  )
}
