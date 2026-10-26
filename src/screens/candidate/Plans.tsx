import { useState } from 'react'
import { useStore } from '../../store'
import { bookingFor, fit, isOpen, oppOf, unlocked } from '../../lib/rules'
import { Calendar, Legend, type CalItem } from '../../components/Calendar'
import { OppCard } from '../../components/OppCard'
import { Bell } from '../../components/Overlays'
import { Segmented } from '../../components/ui'

export const CANDIDATE_LEGEND = [
  { tone: 'lav' as const, label: 'Training' },
  { tone: 'mint' as const, label: 'Shift' },
  { tone: 'sun' as const, label: 'Requested' },
  { tone: 'grey' as const, label: 'Done' },
]

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
        tone: b.status === 'pending' ? 'sun' : b.status === 'done' ? 'grey' : o.kind === 'training' ? 'lav' : 'mint',
        node: <OppCard o={o} r={place(o.restaurantId)} showPlace onPlace={() => onPlace(o.restaurantId)} />,
      }))
  } else {
    // Training at stores still locked, shifts at stores already unlocked.
    const now = Date.now()
    items = snap.opps
      .filter((o) => isOpen(o, now) && !bookingFor(snap, o.id, me.id) && (o.kind === 'shift') === unlocked(snap, o.restaurantId, me.id))
      .map((o) => ({ o, r: place(o.restaurantId) }))
      .filter((x) => x.r)
      .sort((a, b) => fit(me, b.o, b.r) - fit(me, a.o, a.r))
      .map(({ o, r }) => ({ id: o.id, start: o.start, tone: o.kind === 'training' ? 'lav' : 'mint', node: <OppCard o={o} r={r} showPlace onPlace={() => onPlace(r.id)} /> }))
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
          <Legend tones={CANDIDATE_LEGEND} />
        </div>
      </div>
      <div className="px-4 pb-6">
        <Calendar key={view} items={items} emptyIcon={view === 'mine' ? '🌤️' : '🔍'} emptyText={view === 'mine' ? 'Free day' : 'Nothing open'} />
      </div>
    </div>
  )
}
