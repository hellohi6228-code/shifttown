import { useEffect, useState } from 'react'
import type { Kind, Restaurant } from '../../types'
import { useStore } from '../../store'
import { canCheckIn, level, oppOf } from '../../lib/rules'
import { DAY } from '../../lib/time'
import { Calendar, Legend, type CalItem } from '../../components/Calendar'
import { Bell, Notifications } from '../../components/Overlays'
import { MiniBuilding } from '../../components/RestaurantSheet'
import { Empty, Icon, TabBar } from '../../components/ui'
import { DemoPanel } from '../candidate/Me'
import { PostSheet, SlotRow, SlotSheet, TodoCard } from './parts'

type Tab = 'home' | 'cal'

/** The store, its level and XP. */
function Hero({ r, all, onPick }: { r: Restaurant; all: Restaurant[]; onPick: (id: string) => void }) {
  const lv = level(r.xp)
  return (
    <div className="flex items-center gap-3 rounded-[28px] bg-white p-3 pr-4 shadow-soft">
      <div className="anim-float -my-2">
        <MiniBuilding r={r} size={88} />
      </div>
      <div className="min-w-0 flex-1">
        <button onClick={() => all.length > 1 && onPick(all[(all.findIndex((x) => x.id === r.id) + 1) % all.length].id)} className="flex max-w-full items-center gap-1.5 text-left text-2xl leading-tight font-extrabold">
          <span className="truncate">{r.name}</span>
          {all.length > 1 && <Icon.swap size={18} />}
        </button>
        <div className="mt-1.5 flex items-center justify-between text-[15px] font-extrabold">
          <span className="rounded-full bg-sun px-2.5">Lv {lv.lv}</span>
          <span className="text-muted">{lv.next === null ? 'MAX' : `${lv.n} / ${lv.next} XP`}</span>
        </div>
        <div className="mt-1 h-3.5 overflow-hidden rounded-full bg-line">
          <div className="h-full rounded-full bg-gradient-to-r from-sun to-pink transition-all duration-700" style={{ width: `${Math.max(6, lv.pct * 100)}%` }} />
        </div>
      </div>
    </div>
  )
}

function Home({ r, onPost, onSlot }: { r: Restaurant; onPost: (k: Kind) => void; onSlot: (id: string) => void }) {
  const { snap } = useStore()
  const now = Date.now()
  const mine = snap.opps.filter((o) => o.restaurantId === r.id)
  const byId = new Map(mine.map((o) => [o.id, o]))
  // Everything waiting on the restaurant, soonest first.
  const todo = snap.bookings
    .filter((b) => byId.has(b.oppId))
    .filter((b) => {
      const o = byId.get(b.oppId)!
      if (b.status === 'pending') return +new Date(o.start) > now
      if (b.status === 'confirmed') return canCheckIn(o, b, 'restaurant')
      if (b.status === 'checked_in') return true
      if (b.status === 'done') return now - +new Date(o.end) < 14 * DAY && !snap.reviews.some((v) => v.bookingId === b.id)
      return false
    })
    .sort((a, b) => +new Date(byId.get(a.oppId)!.start) - +new Date(byId.get(b.oppId)!.start))
  const upcoming = mine.filter((o) => !o.cancelled && +new Date(o.end) > now).sort((a, b) => +new Date(a.start) - +new Date(b.start))

  return (
    <div className="flex flex-col gap-4">
      <div className="grid grid-cols-2 gap-3">
        <button onClick={() => onPost('training')} className="flex h-20 items-center justify-center gap-2 rounded-3xl bg-lav text-xl font-extrabold text-white shadow-[0_5px_0_#9a80e6] active:translate-y-1 active:shadow-none">
          <span className="text-3xl">🎓</span>+ Training
        </button>
        <button onClick={() => onPost('shift')} className="flex h-20 items-center justify-center gap-2 rounded-3xl bg-mint text-xl font-extrabold text-white shadow-[0_5px_0_#3fa47f] active:translate-y-1 active:shadow-none">
          <span className="text-3xl">🍳</span>+ Shift
        </button>
      </div>
      <section>
        <h3 className="mb-2 flex items-center gap-2 px-1 text-lg font-extrabold">
          ⚡ To do
          {todo.length > 0 && <span className="rounded-full bg-red px-2 text-[14px] text-white">{todo.length}</span>}
        </h3>
        <div className="flex flex-col gap-2">{todo.length ? todo.map((b) => <TodoCard key={b.id} b={b} o={byId.get(b.oppId)!} />) : <Empty icon="✨" text="All done" />}</div>
      </section>
      <section>
        <h3 className="mb-2 px-1 text-lg font-extrabold">📋 Coming up</h3>
        <div className="flex flex-col gap-2">{upcoming.length ? upcoming.map((o) => <SlotRow key={o.id} o={o} onOpen={() => onSlot(o.id)} />) : <Empty icon="📣" text="Post a training or shift" />}</div>
      </section>
    </div>
  )
}

function Schedule({ r, onSlot }: { r: Restaurant; onSlot: (id: string) => void }) {
  const { snap } = useStore()
  const now = Date.now()
  const items: CalItem[] = snap.opps
    .filter((o) => o.restaurantId === r.id && !o.cancelled)
    .map((o) => ({
      id: o.id,
      start: o.start,
      tone: +new Date(o.end) < now ? 'grey' : o.filled < o.openings ? 'red' : o.kind === 'training' ? 'lav' : 'mint',
      node: <SlotRow o={o} onOpen={() => onSlot(o.id)} />,
    }))
  return (
    <div className="flex flex-col gap-2">
      <Legend
        tones={[
          { tone: 'lav', label: 'Training' },
          { tone: 'mint', label: 'Shift' },
          { tone: 'red', label: 'Open spots' },
          { tone: 'grey', label: 'Done' },
        ]}
      />
      <Calendar items={items} emptyIcon="📣" emptyText="Nothing posted" />
    </div>
  )
}

export function ManagerApp() {
  const { snap, setMode } = useStore()
  const mine = snap.restaurants.filter((r) => snap.myRestaurantIds.includes(r.id))
  const [rid, setRid] = useState(() => {
    try {
      return localStorage.getItem('st.rid') || ''
    } catch {
      return ''
    }
  })
  const r = mine.find((x) => x.id === rid) ?? mine[mine.length - 1]
  useEffect(() => {
    try {
      if (r) localStorage.setItem('st.rid', r.id)
    } catch {
      /* ignore */
    }
  }, [r])
  const [tab, setTab] = useState<Tab>('home')
  const [slot, setSlot] = useState<string | null>(null)
  const [posting, setPosting] = useState<Kind | null>(null)
  const [bell, setBell] = useState(false)
  if (!r) return null
  const waiting = snap.bookings.filter((b) => b.status === 'pending' && oppOf(snap, b)?.restaurantId === r.id).length

  return (
    <div className="flex h-full flex-col">
      <main className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto">
        <div className="pt-safe px-4 pb-8">
          <div className="mb-3 flex items-center justify-between">
            <button onClick={() => setMode('candidate')} aria-label="Find shifts" className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-soft active:scale-95">
              🍳
            </button>
            <Bell onOpen={() => setBell(true)} />
          </div>
          <Hero r={r} all={mine} onPick={setRid} />
          <div className="mt-4">
            {tab === 'home' && <Home r={r} onPost={setPosting} onSlot={setSlot} />}
            {tab === 'cal' && <Schedule r={r} onSlot={setSlot} />}
          </div>
          <div className="mt-8">
            <DemoPanel />
          </div>
        </div>
      </main>
      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'home', icon: <Icon.board />, label: 'Home', dot: waiting },
          { id: 'cal', icon: <Icon.cal />, label: 'Calendar' },
        ]}
      />
      <PostSheet kind={posting} onClose={() => setPosting(null)} restaurantId={r.id} />
      <SlotSheet id={slot} onClose={() => setSlot(null)} />
      <Notifications open={bell} onClose={() => setBell(false)} />
    </div>
  )
}
