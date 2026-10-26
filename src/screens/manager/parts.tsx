import { useState } from 'react'
import type { Booking, Kind, Opportunity, Profile } from '../../types'
import { useStore } from '../../store'
import { canCheckIn, icon, level, pointsAt, ROLE_ICON, ROLES, SKILLS, title, validatePost } from '../../lib/rules'
import { addDays, at, fmtDay, fmtDuration, fmtPay, fmtTimeRange, HOUR, startOfDay } from '../../lib/time'
import { Avatar } from '../../components/Avatar'
import { bar, STATUS, when } from '../../components/OppCard'
import { Btn, Chip, Empty, Pill, Sheet, useConfirm } from '../../components/ui'

const unknown: Profile = { id: '?', name: 'Someone', look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, outfitColor: 0, acc: 0 }, area: 'downtown', radiusMi: 2.5, slots: [], roles: [], skills: [] }

export function usePerson() {
  const { snap } = useStore()
  return (id: string) => snap.people.find((p) => p.id === id) ?? (snap.me?.id === id ? snap.me : { ...unknown, id })
}

function Stars({ value, size = 14 }: { value: number; size?: number }) {
  return (
    <span className="tracking-tight" style={{ fontSize: size }}>
      {[1, 2, 3, 4, 5].map((i) => (
        <span key={i} className={i <= Math.round(value) ? 'text-sun' : 'text-line'}>
          ★
        </span>
      ))}
    </span>
  )
}

/** Who they are: level, points here, reviews. */
export function PersonLine({ id, restaurantId }: { id: string; restaurantId: string }) {
  const { snap } = useStore()
  const p = usePerson()(id)
  const s = snap.stats[id]
  const lv = level(s?.quests ?? 0).lv
  const pts = pointsAt(snap, restaurantId, id)
  return (
    <span className="flex min-w-0 items-center gap-2.5">
      <span className="relative shrink-0">
        <span className="block overflow-hidden rounded-full bg-pink-soft">
          <Avatar look={p.look} head size={46} anim="none" />
        </span>
        <span className="absolute -right-1 -bottom-1 rounded-full bg-sun px-1.5 text-[11px] leading-[18px] font-extrabold text-ink ring-2 ring-white">{lv}</span>
      </span>
      <span className="min-w-0">
        <span className="flex items-center gap-1.5 truncate text-[17px] font-extrabold">
          {p.name}
          {pts > 0 && <span className="text-[14px] text-sun-deep">⭐{pts}</span>}
        </span>
        <span className="flex items-center gap-1 text-[13px] font-bold text-muted">
          {s?.rating ? (
            <>
              <Stars value={s.rating} />
              {s.rating.toFixed(1)} ({s.reviews})
            </>
          ) : (
            'New'
          )}
        </span>
      </span>
    </span>
  )
}

/** The one thing to do for this person now. */
export function NextStep({ b, o }: { b: Booking; o: Opportunity }) {
  const { snap, api, act, busy } = useStore()
  const key = `bk-${b.id}`
  const loading = busy === key
  if (b.status === 'pending')
    return (
      <div className="flex gap-1.5">
        <Btn size="sm" tone="white" loading={loading} label="Decline" onClick={() => act(key, () => api.confirm(b.id, false), 'Declined')}>
          ✕
        </Btn>
        <Btn size="sm" tone="mint" loading={loading} onClick={() => act(key, () => api.confirm(b.id, true), 'Confirmed ✓')}>
          Confirm
        </Btn>
      </div>
    )
  if (b.status === 'confirmed' && canCheckIn(o, b, 'restaurant'))
    return (
      <Btn size="sm" tone="sky" loading={loading} onClick={() => act(key, () => api.checkIn(b.id), 'Checked in 🟢')}>
        Check in
      </Btn>
    )
  if (b.status === 'checked_in')
    return (
      <Btn size="sm" tone="pink" loading={loading} onClick={() => act(key, () => api.checkOut(b.id), '+1 XP 🎉')}>
        Check out
      </Btn>
    )
  if (b.status === 'done' && !snap.reviews.some((r) => r.bookingId === b.id))
    return (
      <div className="flex" role="group" aria-label="Review">
        {[1, 2, 3, 4, 5].map((n) => (
          <button key={n} aria-label={`${n} stars`} disabled={loading} onClick={() => act(key, () => api.review(b.id, n), '+1 XP ★')} className="px-0.5 text-[26px] leading-none text-sun/50 transition hover:text-sun active:scale-125">
            ★
          </button>
        ))}
      </div>
    )
  const stars = snap.reviews.find((r) => r.bookingId === b.id)?.stars
  return stars ? <Stars value={stars} size={16} /> : <Pill className={STATUS[b.status].cls}>{STATUS[b.status].label}</Pill>
}

export function TodoCard({ b, o, showSlot = true }: { b: Booking; o: Opportunity; showSlot?: boolean }) {
  return (
    <div className={`relative overflow-hidden rounded-3xl bg-white p-3 shadow-soft ${showSlot ? 'pl-5' : ''}`}>
      {showSlot && <div className={`absolute top-0 bottom-0 left-0 w-2 ${bar(o)}`} />}
      <div className="flex items-center justify-between gap-2">
        <PersonLine id={b.candidateId} restaurantId={o.restaurantId} />
        <div className="shrink-0">
          <NextStep b={b} o={o} />
        </div>
      </div>
      {showSlot && (
        <div className="mt-1.5 truncate text-[14px] font-semibold text-ink/70">
          {icon(o)} {title(o)} · {when(o)}
        </div>
      )}
    </div>
  )
}

export function SlotRow({ o, onOpen }: { o: Opportunity; onOpen: () => void }) {
  const { snap } = useStore()
  const person = usePerson()
  const people = snap.bookings.filter((b) => b.oppId === o.id && b.status !== 'declined' && b.status !== 'cancelled')
  const upcoming = +new Date(o.end) > Date.now()
  const gap = upcoming && o.filled < o.openings
  return (
    <button onClick={onOpen} className={`relative flex w-full items-center gap-3 overflow-hidden rounded-3xl bg-white p-3 pl-5 text-left shadow-soft active:scale-[0.99] ${o.cancelled ? 'opacity-50' : ''}`}>
      <span className={`absolute top-0 bottom-0 left-0 w-2 ${bar(o)}`} />
      <span className="text-2xl">{icon(o)}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-extrabold">{title(o)}</span>
        <span className="block truncate text-[14px] font-semibold text-muted">{when(o)}</span>
      </span>
      <span className="flex shrink-0 items-center gap-2">
        <span className="flex -space-x-2.5">
          {people.slice(0, 3).map((b) => (
            <span key={b.id} className={`overflow-hidden rounded-full bg-pink-soft ring-2 ring-white ${b.status === 'pending' ? 'opacity-50' : ''}`}>
              <Avatar look={person(b.candidateId).look} head size={30} anim="none" />
            </span>
          ))}
        </span>
        <span className={`text-[15px] font-extrabold ${gap ? 'text-red' : 'text-mint-deep'}`}>
          {o.filled}/{o.openings}
        </span>
      </span>
    </button>
  )
}

export function SlotSheet({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { snap, api, act, busy } = useStore()
  const confirm = useConfirm()
  const o = snap.opps.find((x) => x.id === id)
  if (!o) return <Sheet open={false} onClose={onClose}>{null}</Sheet>
  const roster = snap.bookings.filter((b) => b.oppId === o.id && b.status !== 'cancelled' && b.status !== 'declined')
  const upcoming = +new Date(o.start) > Date.now() && !o.cancelled
  return (
    <Sheet open onClose={onClose}>
      <div className={`mt-1 rounded-3xl p-4 ${o.kind === 'training' ? 'bg-lav-soft' : 'bg-mint-soft'}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-2xl leading-tight font-extrabold">
              {icon(o)} {title(o)}
            </div>
            <div className="font-bold text-ink/75">
              {fmtDay(o.start)} · {fmtTimeRange(o.start, o.end)} · {fmtDuration(o.start, o.end)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold text-mint-deep">{fmtPay(o.payCents)}</div>
            <div className="font-extrabold">
              {o.filled}/{o.openings}
            </div>
          </div>
        </div>
      </div>
      <div className="mt-3 flex flex-col gap-2">
        {roster.length ? roster.map((b) => <TodoCard key={b.id} b={b} o={o} showSlot={false} />) : <Empty icon="🪑" text="No one yet" />}
      </div>
      {upcoming && (
        <div className="mt-6 mb-4 flex justify-center">
          <Btn tone={confirm.armed === o.id ? 'red' : 'ghost'} loading={busy === `cx-${o.id}`} onClick={() => confirm.tap(o.id, () => act(`cx-${o.id}`, () => api.cancelOpp(o.id), 'Cancelled').then(onClose))}>
            {confirm.armed === o.id ? 'Tap again to cancel' : '🗑️ Cancel'}
          </Btn>
        </div>
      )}
    </Sheet>
  )
}

const DEFAULT_TIMES: Record<Kind, [string, string]> = { training: ['15:00', '15:30'], shift: ['17:00', '22:00'] }

export function PostSheet({ kind, onClose, restaurantId }: { kind: Kind | null; onClose: () => void; restaurantId: string }) {
  return kind ? <PostForm key={kind} kind={kind} onClose={onClose} restaurantId={restaurantId} /> : <Sheet open={false} onClose={onClose}>{null}</Sheet>
}

function PostForm({ kind, onClose, restaurantId }: { kind: Kind; onClose: () => void; restaurantId: string }) {
  const { api, act, busy, say } = useStore()
  const [role, setRole] = useState('Server')
  const [dayIdx, setDayIdx] = useState(1)
  const [from, setFrom] = useState(DEFAULT_TIMES[kind][0])
  const [to, setTo] = useState(DEFAULT_TIMES[kind][1])
  const [openings, setOpenings] = useState(kind === 'training' ? 3 : 1)
  const [pay, setPay] = useState(kind === 'training' ? '16' : '17')
  const [more, setMore] = useState(false)
  const [skills, setSkills] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const today = startOfDay(new Date())
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i))

  const submit = async () => {
    const day = days[dayIdx]
    const start = at(day, from)
    let end = at(day, to)
    if (+new Date(end) <= +new Date(start)) end = at(addDays(day, 1), to)
    const input = {
      restaurantId, kind, role: kind === 'training' ? 'Training' : role, start, end, openings,
      payCents: Math.round(parseFloat(pay || '0') * 100), skills, notes,
      // Requests close an hour before start; short-notice posts stay open until they start.
      deadline: new Date(+new Date(start) - (+new Date(start) - Date.now() > 2 * HOUR ? HOUR : 0)).toISOString(),
    }
    const err = validatePost(input)
    if (err) return say(err, 'err')
    const ok = await act('post', () => api.post(input).then(() => true), 'Posted! 📣')
    if (ok) onClose()
  }

  return (
    <Sheet open onClose={onClose}>
      <div className="flex flex-col gap-4 pt-1 pb-4">
        <h2 className="px-1 text-2xl font-extrabold">{kind === 'training' ? '🎓 Training' : '🍳 Shift'}</h2>
        {kind === 'shift' && (
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {ROLES.map((x) => (
              <Chip key={x} on={role === x} onClick={() => setRole(x)}>
                {ROLE_ICON[x]} {x}
              </Chip>
            ))}
          </div>
        )}
        <div className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4">
          {days.map((d, i) => (
            <button key={i} onClick={() => setDayIdx(i)} className={`flex h-16 w-12 shrink-0 flex-col items-center justify-center rounded-2xl transition ${dayIdx === i ? 'bg-pink text-white shadow-[0_4px_0_#e0729a]' : 'bg-white shadow-soft'}`}>
              <span className="text-[11px] font-bold uppercase opacity-80">{i === 0 ? 'Today' : d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className="text-lg leading-tight font-extrabold">{d.getDate()}</span>
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input type="time" value={from} onChange={(e) => setFrom(e.target.value)} aria-label="Start" className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-line bg-white px-3 text-lg font-bold outline-none focus:border-pink" />
          <span className="font-extrabold text-muted">→</span>
          <input type="time" value={to} onChange={(e) => setTo(e.target.value)} aria-label="End" className="h-12 min-w-0 flex-1 rounded-2xl border-2 border-line bg-white px-3 text-lg font-bold outline-none focus:border-pink" />
        </div>
        <div className="flex items-center gap-3">
          <div className="flex h-12 items-center rounded-2xl bg-white shadow-soft">
            <button onClick={() => setOpenings(Math.max(1, openings - 1))} className="h-12 w-11 text-2xl font-extrabold text-muted" aria-label="Fewer">
              −
            </button>
            <span className="w-14 text-center text-lg font-extrabold">👤{openings}</span>
            <button onClick={() => setOpenings(Math.min(50, openings + 1))} className="h-12 w-11 text-2xl font-extrabold text-pink-deep" aria-label="More">
              +
            </button>
          </div>
          <div className="flex h-12 min-w-0 flex-1 items-center rounded-2xl border-2 border-mint bg-white px-3">
            <span className="text-lg font-extrabold text-mint-deep">$</span>
            <input value={pay} onChange={(e) => setPay(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" aria-label="Pay per hour" className="w-full min-w-0 bg-transparent px-1 text-lg font-extrabold outline-none" />
            <span className="font-bold text-muted">/h</span>
          </div>
        </div>
        {kind === 'shift' &&
          (more ? (
            <div className="anim-fade flex flex-col gap-3">
              <div className="flex flex-wrap gap-2">
                {SKILLS.map((s) => (
                  <Chip key={s} tone="lav" on={skills.includes(s)} onClick={() => setSkills(skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s])}>
                    {s}
                  </Chip>
                ))}
              </div>
              <input value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 200))} placeholder="📝 Notes" className="h-12 rounded-2xl border-2 border-line bg-white px-4 font-semibold outline-none focus:border-pink" />
            </div>
          ) : (
            <button onClick={() => setMore(true)} className="self-start rounded-full px-2 text-[15px] font-bold text-muted">
              ＋ Skills · notes
            </button>
          ))}
        <Btn size="lg" tone={kind === 'training' ? 'lav' : 'mint'} className="w-full" loading={busy === 'post'} onClick={submit}>
          📣 Post
        </Btn>
      </div>
    </Sheet>
  )
}
