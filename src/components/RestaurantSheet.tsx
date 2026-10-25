import type { Restaurant } from '../types'
import { useStore } from '../store'
import { area, milesBetween, toGrid, travel } from '../lib/geo'
import { bookingFor, isOpen, pointsAt, stage, STAGES } from '../lib/rules'
import { Building } from './map/Building'
import { px } from './map/geometry'
import { OppCard } from './OppCard'
import { Empty, Pill, Sheet } from './ui'

export function MiniBuilding({ r, size = 84 }: { r: Restaurant; size?: number }) {
  const g = toGrid(r.lat, r.lng)
  const c = px(g.gx, g.gy)
  return (
    <svg viewBox={`${c.x - 58} ${c.y - 104} 116 132`} width={size} height={(size * 132) / 116} aria-hidden className="shrink-0">
      <Building r={r} state="hiring" selected={false} faded={false} onTap={() => {}} />
    </svg>
  )
}

export function StageTrack({ current }: { current: string }) {
  const idx = STAGES.findIndex((s) => s.id === current)
  return (
    <div className="flex items-center">
      {STAGES.map((s, i) => (
        <div key={s.id} className="flex flex-1 items-center last:flex-none">
          <div
            title={s.label}
            className={`flex h-9 w-9 shrink-0 items-center justify-center rounded-full text-base transition ${i <= idx ? 'bg-sun shadow-pop' : 'bg-line grayscale opacity-60'} ${i === idx ? 'anim-pop ring-4 ring-sun/40' : ''}`}
          >
            {s.icon}
          </div>
          {i < STAGES.length - 1 && <div className={`mx-1 h-1.5 flex-1 rounded-full ${i < idx ? 'bg-sun' : 'bg-line'}`} />}
        </div>
      ))}
    </div>
  )
}

export function RestaurantSheet({ r, onClose }: { r: Restaurant | null; onClose: () => void }) {
  const { snap } = useStore()
  const me = snap.me
  if (!r || !me) return <Sheet open={false} onClose={onClose}>{null}</Sheet>
  const t = travel(milesBetween(area(me.area), r))
  const st = stage(snap, r.id, me.id)
  const pts = pointsAt(snap, r.id, me.id)
  const now = Date.now()
  const opps = snap.opps
    .filter((o) => o.restaurantId === r.id && !o.cancelled && +new Date(o.end) > now)
    .filter((o) => isOpen(o, now) || bookingFor(snap, o.id, me.id))
    .sort((a, b) => +new Date(a.start) - +new Date(b.start))
  const meet = opps.filter((o) => o.kind !== 'shift')
  const shifts = opps.filter((o) => o.kind === 'shift')

  return (
    <Sheet open onClose={onClose}>
      <div className="flex items-end gap-3 pt-1">
        <MiniBuilding r={r} />
        <div className="min-w-0 flex-1 pb-2">
          <div className="flex items-center gap-2">
            <h2 className="truncate text-2xl leading-tight font-extrabold">{r.name}</h2>
            {r.demo && <Pill className="bg-lav-soft text-lav-deep">DEMO</Pill>}
          </div>
          <div className="text-[15px] font-semibold text-muted">
            {r.emoji} {r.cuisine} · {t.icon} {t.mins} min
          </div>
          <a href={r.mapsUrl} target="_blank" rel="noreferrer" className="block truncate text-[14px] font-semibold text-sky-deep">
            📍 {r.address}
          </a>
        </div>
        {pts > 0 && (
          <div className="mb-2 flex flex-col items-center rounded-2xl bg-sun-soft px-2.5 py-1">
            <span className="text-xl leading-none font-extrabold text-sun-deep">⭐{pts}</span>
          </div>
        )}
      </div>
      <div className="mt-2 rounded-3xl bg-white p-3 shadow-soft">
        <StageTrack current={st} />
      </div>
      {!opps.length && <Empty icon="😴" text="No openings now" />}
      {meet.length > 0 && (
        <section className="mt-4">
          <h3 className="mb-2 px-1 text-lg font-extrabold">👋 Meet & train</h3>
          <div className="flex flex-col gap-2.5">
            {meet.map((o) => (
              <OppCard key={o.id} o={o} r={r} />
            ))}
          </div>
        </section>
      )}
      {shifts.length > 0 && (
        <section className="mt-4 mb-4">
          <h3 className="mb-2 px-1 text-lg font-extrabold">🍳 Shifts</h3>
          <div className="flex flex-col gap-2.5">
            {shifts.map((o) => (
              <OppCard key={o.id} o={o} r={r} />
            ))}
          </div>
        </section>
      )}
    </Sheet>
  )
}
