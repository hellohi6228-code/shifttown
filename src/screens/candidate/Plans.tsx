import { useState } from 'react'
import { useStore } from '../../store'
import { bookingFor, isOpen, KIND, match, oppOf } from '../../lib/rules'
import { Calendar, Legend, type CalItem, type CalTone } from '../../components/Calendar'
import { OppCard } from '../../components/OppCard'
import { Bell } from '../../components/Overlays'
import { Segmented } from '../../components/ui'

const kindTone = (k: string): CalTone => (KIND[k as keyof typeof KIND]?.tone as CalTone) ?? 'mint'

export function Plans({ onBell, onPlace }: { onBell: () => void; onPlace: (restaurantId: string) => void }) {
  const { snap } = useStore()
  const me = snap.me!
  const [view, setView] = useState<'mine' | 'open'>('mine')
  const place = (id: string) => snap.restaurants.find((r) => r.id === id)!

  let items: CalItem[]
  if (view === 'mine') {
    items = snap.bookings
      .filter((b) => b.candidateId === me.id && b.status !== 'declined' && b.status !== 'cancelled')
      .map((b) => ({ b, o: oppOf(snap, b)! }))
      .filter((x) => x.o)
      .map(({ b, o }) => ({
        id: b.id,
        start: o.start,
        tone: b.status === 'invited' ? 'pink' : b.status === 'pending' ? 'sun' : b.status === 'attended' || b.status === 'no_show' ? 'grey' : kindTone(o.kind),
        node: <OppCard o={o} r={place(o.restaurantId)} showPlace onPlace={() => onPlace(o.restaurantId)} />,
      }))
  } else {
    const now = Date.now()
    items = snap.opps
      .filter((o) => isOpen(o, now) && !bookingFor(snap, o.id, me.id))
      .map((o) => ({ o, r: place(o.restaurantId) }))
      .filter((x) => x.r)
      .sort((a, b) => match(me, b.o, b.r, snap).score - match(me, a.o, a.r, snap).score)
      .map(({ o, r }) => ({ id: o.id, start: o.start, tone: kindTone(o.kind), node: <OppCard o={o} r={r} showPlace onPlace={() => onPlace(r.id)} /> }))
  }

  return (
    <div className="no-scrollbar h-full overflow-y-auto">
      <div className="pt-safe sticky top-0 z-10 bg-cream/95 px-4 pb-2 backdrop-blur">
        <div className="flex items-center gap-3">
          <div className="flex-1">
            <Segmented
              value={view}
              onChange={setView}
              options={[
                { id: 'mine', label: '📅 Mine' },
                { id: 'open', label: '🔎 Open' },
              ]}
            />
          </div>
          <Bell onOpen={onBell} />
        </div>
        <div className="mt-2">
          <Legend />
        </div>
      </div>
      <div className="px-4 pb-6">
        <Calendar key={view} items={items} emptyIcon={view === 'mine' ? '🌤️' : '🔍'} emptyText={view === 'mine' ? 'Free day' : 'Nothing open'} />
      </div>
    </div>
  )
}
