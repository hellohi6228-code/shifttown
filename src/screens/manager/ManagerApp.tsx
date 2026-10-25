import { useEffect, useState } from 'react'
import type { Restaurant } from '../../types'
import { useStore } from '../../store'
import { area, milesBetween } from '../../lib/geo'
import { canRecord, isOpen, oppOf, pointsAt, stage, STAGES } from '../../lib/rules'
import { Avatar } from '../../components/Avatar'
import { Calendar, Legend, type CalItem } from '../../components/Calendar'
import { Bell, Notifications } from '../../components/Overlays'
import { MiniBuilding } from '../../components/RestaurantSheet'
import { Btn, Chip, Empty, Icon, Pill, Segmented, TabBar } from '../../components/ui'
import { DemoPanel } from '../candidate/Me'
import { BookingRow, OppRow, OppSheet, PersonSheet, PostSheet, usePerson } from './parts'

type Tab = 'board' | 'cal' | 'people'

function Header({ r, all, onPick, onBell }: { r: Restaurant; all: Restaurant[]; onPick: (id: string) => void; onBell: () => void }) {
  const { api, act, setMode } = useStore()
  return (
    <div className="flex items-end gap-2">
      <MiniBuilding r={r} size={64} />
      <div className="min-w-0 flex-1 pb-1">
        <button
          onClick={() => all.length > 1 && onPick(all[(all.findIndex((x) => x.id === r.id) + 1) % all.length].id)}
          className="flex max-w-full items-center gap-1.5 text-left text-2xl leading-tight font-extrabold"
        >
          <span className="truncate">{r.name}</span>
          {all.length > 1 && <Icon.swap size={18} />}
        </button>
        <div className="mt-0.5 flex items-center gap-1.5">
          {r.demo && <Pill className="bg-lav-soft text-lav-deep">DEMO</Pill>}
          <Chip tone="sun" on={r.autoConfirm} onClick={() => act('auto', () => api.setAutoConfirm(r.id, !r.autoConfirm), r.autoConfirm ? '🙋 You approve' : '⚡ Auto-confirm')} className="!h-8 !px-2.5 !text-[13px]">
            ⚡ Auto
          </Chip>
        </div>
      </div>
      <div className="flex items-center gap-2 pb-1">
        <button onClick={() => setMode('candidate')} aria-label="Find shifts" className="flex h-12 w-12 items-center justify-center rounded-full bg-white text-xl shadow-soft active:scale-95">
          🍳
        </button>
        <Bell onOpen={onBell} />
      </div>
    </div>
  )
}

function Board({ r, onOpp, onPerson }: { r: Restaurant; onOpp: (id: string) => void; onPerson: (id: string) => void }) {
  const { snap } = useStore()
  const now = Date.now()
  const mine = snap.opps.filter((o) => o.restaurantId === r.id)
  const byId = new Map(mine.map((o) => [o.id, o]))
  const live = snap.bookings.filter((b) => byId.has(b.oppId))
  const requests = live.filter((b) => b.status === 'pending')
  const attendance = live.filter((b) => b.status === 'confirmed' && canRecord(byId.get(b.oppId)!))
  const upcoming = mine.filter((o) => !o.cancelled && +new Date(o.end) > now).sort((a, b) => +new Date(a.start) - +new Date(b.start))
  const gaps = upcoming.reduce((n, o) => n + Math.max(0, o.openings - o.filled), 0)
  const todo = [...requests, ...attendance].sort((a, b) => +new Date(byId.get(a.oppId)!.start) - +new Date(byId.get(b.oppId)!.start))
  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-3 gap-2">
        {[
          ['📅', upcoming.length, 'bg-sky-soft'],
          ['🙋', requests.length, 'bg-sun-soft'],
          ['🪑', gaps, gaps ? 'bg-red-soft' : 'bg-mint-soft'],
        ].map(([icon, n, bg]) => (
          <div key={icon as string} className={`flex items-center justify-center gap-2 rounded-3xl py-3 ${bg}`}>
            <span className="text-2xl">{icon}</span>
            <span className="text-2xl font-extrabold">{n}</span>
          </div>
        ))}
      </div>
      {todo.length > 0 && (
        <section>
          <h3 className="mb-2 px-1 text-lg font-extrabold">⚡ Now</h3>
          <div className="flex flex-col gap-2">
            {todo.map((b) => (
              <BookingRow key={b.id} b={b} o={byId.get(b.oppId)!} onPerson={onPerson} showOpp />
            ))}
          </div>
        </section>
      )}
      <section>
        <h3 className="mb-2 px-1 text-lg font-extrabold">📋 Upcoming</h3>
        <div className="flex flex-col gap-2">{upcoming.length ? upcoming.map((o) => <OppRow key={o.id} o={o} onOpen={() => onOpp(o.id)} />) : <Empty icon="📣" text="Tap ＋ to post" />}</div>
      </section>
    </div>
  )
}

function People({ r, onPerson }: { r: Restaurant; onPerson: (id: string) => void }) {
  const { snap } = useStore()
  const person = usePerson()
  const [view, setView] = useState<'ours' | 'near'>('ours')
  const touched = new Set(snap.bookings.filter((b) => oppOf(snap, b)?.restaurantId === r.id).map((b) => b.candidateId))
  const list =
    view === 'ours'
      ? [...touched].map((id) => person(id)).sort((a, b) => pointsAt(snap, r.id, b.id) - pointsAt(snap, r.id, a.id))
      : snap.people.filter((p) => p.discoverable).sort((a, b) => milesBetween(area(a.area), r) - milesBetween(area(b.area), r))
  return (
    <div className="flex flex-col gap-3">
      <Segmented
        value={view}
        onChange={setView}
        options={[
          { id: 'ours', label: '⭐ Ours' },
          { id: 'near', label: '📍 Nearby' },
        ]}
      />
      {list.length === 0 && <Empty icon="👀" text="No one yet" />}
      {list.map((p) => {
        const st = stage(snap, r.id, p.id)
        const pts = pointsAt(snap, r.id, p.id)
        return (
          <button key={p.id} onClick={() => onPerson(p.id)} className="flex items-center gap-3 rounded-3xl bg-white p-2.5 text-left shadow-soft active:scale-[0.99]">
            <span className="shrink-0 overflow-hidden rounded-full bg-pink-soft">
              <Avatar look={p.look} head size={48} anim="none" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex items-center gap-1.5 text-lg font-extrabold">
                {p.name}
                {p.demo && <span className="text-[11px] font-bold text-lav-deep">DEMO</span>}
              </span>
              <span className="block truncate text-[14px] font-semibold text-muted">
                {view === 'near' ? `📍 ${area(p.area).name} · ` : ''}
                {p.roles.slice(0, 3).join(' · ')}
              </span>
            </span>
            <span className="text-xl" title={st}>
              {STAGES.find((s) => s.id === st)?.icon}
            </span>
            <span className="min-w-11 text-right text-lg font-extrabold text-sun-deep">{pts > 0 ? `⭐${pts}` : ''}</span>
          </button>
        )
      })}
    </div>
  )
}

function Schedule({ r, onOpp }: { r: Restaurant; onOpp: (id: string) => void }) {
  const { snap } = useStore()
  const now = Date.now()
  const items: CalItem[] = snap.opps
    .filter((o) => o.restaurantId === r.id && !o.cancelled)
    .map((o) => ({
      id: o.id,
      start: o.start,
      tone: +new Date(o.end) < now ? 'grey' : isOpen(o, now) && o.filled < o.openings ? 'red' : o.kind === 'intro' ? 'sky' : o.kind === 'training' ? 'lav' : 'mint',
      node: <OppRow o={o} onOpen={() => onOpp(o.id)} />,
    }))
  return (
    <div className="flex flex-col gap-2">
      <Legend
        tones={[
          { tone: 'sky', label: 'Intro' },
          { tone: 'lav', label: 'Training' },
          { tone: 'mint', label: 'Filled' },
          { tone: 'red', label: 'Gap' },
          { tone: 'grey', label: 'Done' },
        ]}
      />
      <Calendar items={items} emptyIcon="📣" emptyText="Nothing posted" />
    </div>
  )
}

export function ManagerApp() {
  const { snap } = useStore()
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
  const [tab, setTab] = useState<Tab>('board')
  const [opp, setOpp] = useState<string | null>(null)
  const [person, setPerson] = useState<string | null>(null)
  const [posting, setPosting] = useState(false)
  const [bell, setBell] = useState(false)
  if (!r) return null
  const requests = snap.bookings.filter((b) => b.status === 'pending' && oppOf(snap, b)?.restaurantId === r.id).length

  return (
    <div className="flex h-full flex-col">
      <main className="no-scrollbar relative min-h-0 flex-1 overflow-y-auto">
        <div className="pt-safe sticky top-0 z-10 bg-cream/95 px-4 pb-2 backdrop-blur">
          <Header r={r} all={mine} onPick={setRid} onBell={() => setBell(true)} />
        </div>
        <div className="px-4 pt-2 pb-28">
          {tab === 'board' && <Board r={r} onOpp={setOpp} onPerson={setPerson} />}
          {tab === 'cal' && <Schedule r={r} onOpp={setOpp} />}
          {tab === 'people' && <People r={r} onPerson={setPerson} />}
          <div className="mt-8">
            <DemoPanel />
          </div>
        </div>
      </main>
      <div className="pointer-events-none fixed inset-x-0 bottom-24 z-20 mx-auto flex max-w-xl justify-end px-5">
        <Btn tone="pink" size="lg" className="pointer-events-auto !h-16 !w-16 !rounded-full !p-0" onClick={() => setPosting(true)} label="Post">
          <Icon.plus size={30} />
        </Btn>
      </div>
      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'board', icon: <Icon.board />, label: 'Today', dot: requests },
          { id: 'cal', icon: <Icon.cal />, label: 'Calendar' },
          { id: 'people', icon: <Icon.people />, label: 'People' },
        ]}
      />
      <PostSheet open={posting} onClose={() => setPosting(false)} restaurantId={r.id} />
      <OppSheet id={opp} onClose={() => setOpp(null)} onPerson={(id) => setPerson(id)} />
      <PersonSheet id={person} restaurantId={r.id} onClose={() => setPerson(null)} />
      <Notifications open={bell} onClose={() => setBell(false)} />
    </div>
  )
}
