import { useState } from 'react'
import type { Booking, Kind, Opportunity, Profile, Restaurant } from '../../types'
import { useStore } from '../../store'
import { area, milesBetween, travel } from '../../lib/geo'
import { bookingFor, canRecord, isEligible, KIND, match, oppOf, pointsAt, ROLE_ICON, ROLES, SKILLS, stage, validatePost } from '../../lib/rules'
import { addDays, at, fmtDay, fmtDuration, fmtPay, fmtTimeRange, HOUR, startOfDay } from '../../lib/time'
import { Avatar } from '../../components/Avatar'
import { STATUS, TONE } from '../../components/OppCard'
import { SlotGrid } from '../../components/Prefs'
import { StageTrack } from '../../components/RestaurantSheet'
import { Btn, Chip, Empty, Icon, Pill, Sheet, useConfirm } from '../../components/ui'

const unknown: Profile = { id: '?', name: 'Someone', look: { skin: 0, hair: 0, hairColor: 0, outfit: 0, outfitColor: 0, acc: 0 }, area: 'downtown', radiusMi: 2.5, slots: [], roles: [], skills: [], discoverable: false }

export function usePerson() {
  const { snap } = useStore()
  return (id: string) => snap.people.find((p) => p.id === id) ?? (snap.me?.id === id ? snap.me : { ...unknown, id })
}

export const label = (o: Opportunity) => (o.kind === 'shift' ? o.role : o.kind === 'intro' ? 'Intro' : `Training · ${o.role}`)

/** One person on a roster, with the single action that's due. */
export function BookingRow({ b, o, onPerson, showOpp = false }: { b: Booking; o: Opportunity; onPerson: (id: string) => void; showOpp?: boolean }) {
  const { snap, api, act, busy } = useStore()
  const person = usePerson()(b.candidateId)
  const pts = pointsAt(snap, o.restaurantId, b.candidateId)
  const key = `bk-${b.id}`
  const loading = busy === key
  let action: React.ReactNode = <Pill className={STATUS[b.status].cls}>{STATUS[b.status].label}</Pill>
  if (b.status === 'pending')
    action = (
      <div className="flex gap-1.5">
        <Btn size="sm" tone="white" loading={loading} onClick={() => act(key, () => api.decide(b.id, false), 'Declined')} label="Decline">
          ✕
        </Btn>
        <Btn size="sm" tone="mint" loading={loading} onClick={() => act(key, () => api.decide(b.id, true), 'Approved ✓')} label="Approve">
          <Icon.check size={18} />
        </Btn>
      </div>
    )
  else if (b.status === 'confirmed' && canRecord(o))
    action = (
      <div className="flex gap-1.5">
        <Btn size="sm" tone="white" loading={loading} onClick={() => act(key, () => api.attend(b.id, false), 'Marked absent')} label="Absent">
          🚫
        </Btn>
        {o.kind === 'shift' ? (
          <Btn size="sm" tone="mint" loading={loading} onClick={() => act(key, () => api.attend(b.id, true), '+1 ⭐')} label="Done">
            <Icon.check size={18} />
          </Btn>
        ) : (
          <>
            <Btn size="sm" tone="white" loading={loading} onClick={() => act(key, () => api.attend(b.id, true, false), '+1 ⭐')} label="Came">
              <Icon.check size={18} />
            </Btn>
            <Btn size="sm" tone="mint" loading={loading} onClick={() => act(key, () => api.attend(b.id, true, true), '+1 ⭐ · 🔓')} label="Came and eligible">
              ✓🔓
            </Btn>
          </>
        )}
      </div>
    )
  return (
    <div className="flex items-center gap-2.5 rounded-2xl bg-white p-2 pr-2.5 shadow-soft">
      <button onClick={() => onPerson(person.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
        <span className="shrink-0 overflow-hidden rounded-full bg-pink-soft">
          <Avatar look={person.look} head size={42} anim="none" />
        </span>
        <span className="min-w-0">
          <span className="flex items-center gap-1.5 truncate font-extrabold">
            {person.name}
            {pts > 0 && <span className="text-[14px] text-sun-deep">⭐{pts}</span>}
            {b.source === 'invite' && <span className="text-[13px]">✉️</span>}
          </span>
          {showOpp && (
            <span className="block truncate text-[13px] font-semibold text-muted">
              {KIND[o.kind].icon} {label(o)} · {fmtDay(o.start)} {fmtTimeRange(o.start, o.end)}
            </span>
          )}
        </span>
      </button>
      <div className="shrink-0">{action}</div>
    </div>
  )
}

export function Fill({ o }: { o: Opportunity }) {
  const pct = Math.min(100, (o.filled / o.openings) * 100)
  const full = o.filled >= o.openings
  return (
    <div className="flex items-center gap-2">
      <div className="h-2.5 w-16 overflow-hidden rounded-full bg-line">
        <div className={`h-full rounded-full ${full ? 'bg-mint' : 'bg-sun'}`} style={{ width: `${Math.max(pct, 4)}%` }} />
      </div>
      <span className={`text-[14px] font-extrabold ${full ? 'text-mint-deep' : 'text-sun-deep'}`}>
        {o.filled}/{o.openings}
      </span>
    </div>
  )
}

export function OppRow({ o, onOpen }: { o: Opportunity; onOpen: () => void }) {
  const { snap } = useStore()
  const t = TONE[KIND[o.kind].tone]
  const pending = snap.bookings.filter((b) => b.oppId === o.id && b.status === 'pending').length
  const past = +new Date(o.end) < Date.now()
  const gap = !past && !o.cancelled && o.filled < o.openings
  return (
    <button onClick={onOpen} className={`relative flex w-full items-center gap-3 overflow-hidden rounded-3xl bg-white p-3 pl-5 text-left shadow-soft active:scale-[0.99] ${o.cancelled ? 'opacity-50' : ''}`}>
      <span className={`absolute top-0 bottom-0 left-0 w-2 ${t.bar}`} />
      <span className={`flex h-11 w-11 shrink-0 items-center justify-center rounded-2xl text-2xl ${t.soft}`}>{o.kind === 'shift' ? ROLE_ICON[o.role] ?? '🍳' : KIND[o.kind].icon}</span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-extrabold">
          {label(o)} {o.cancelled && <span className="text-red">· Cancelled</span>}
        </span>
        <span className="block truncate text-[14px] font-semibold text-muted">
          {fmtDay(o.start)} · {fmtTimeRange(o.start, o.end)}
        </span>
      </span>
      <span className="flex shrink-0 flex-col items-end gap-1">
        <Fill o={o} />
        <span className="flex gap-1">
          {pending > 0 && <Pill className="bg-sun-soft text-sun-deep">🙋 {pending}</Pill>}
          {gap && <Pill className="bg-red-soft text-red">{o.openings - o.filled} open</Pill>}
        </span>
      </span>
    </button>
  )
}

function InviteList({ o, r, onPerson }: { o: Opportunity; r: Restaurant; onPerson: (id: string) => void }) {
  const { snap, api, act, busy } = useStore()
  const ranked = snap.people
    .filter((p) => p.discoverable && !bookingFor(snap, o.id, p.id))
    .filter((p) => o.kind !== 'shift' || isEligible(snap, r.id, p.id))
    .map((p) => ({ p, m: match(p, o, r, snap), pts: pointsAt(snap, r.id, p.id) }))
    .sort((a, b) => b.m.score - a.m.score || b.pts - a.pts)
    .slice(0, 10)
  if (!ranked.length) return <Empty icon="🔍" text={o.kind === 'shift' ? 'No eligible people yet' : 'No one nearby'} />
  return (
    <div className="flex flex-col gap-2">
      {ranked.map(({ p, m, pts }) => {
        const key = `inv-${o.id}-${p.id}`
        return (
          <div key={p.id} className="flex items-center gap-2.5 rounded-2xl bg-white p-2 pr-2.5 shadow-soft">
            <button onClick={() => onPerson(p.id)} className="flex min-w-0 flex-1 items-center gap-2.5 text-left">
              <span className="shrink-0 overflow-hidden rounded-full bg-pink-soft">
                <Avatar look={p.look} head size={42} anim="none" />
              </span>
              <span className="min-w-0">
                <span className="flex items-center gap-1.5 font-extrabold">
                  {p.name}
                  {pts > 0 && <span className="text-[14px] text-sun-deep">⭐{pts}</span>}
                  {p.demo && <span className="text-[11px] font-bold text-lav-deep">DEMO</span>}
                </span>
                <span className="flex flex-wrap gap-1">
                  {m.reasons.filter((x) => x.ok).slice(0, 3).map((x) => (
                    <span key={x.text} className="rounded-full bg-mint-soft px-1.5 text-[11px] leading-5 font-bold text-mint-deep">
                      ✓ {x.text}
                    </span>
                  ))}
                </span>
              </span>
            </button>
            <Btn size="sm" tone="pink" loading={busy === key} onClick={() => act(key, () => api.invite(o.id, p.id), `Invited ${p.name} ✉️`)}>
              ✉️
            </Btn>
          </div>
        )
      })}
    </div>
  )
}

export function OppSheet({ id, onClose, onPerson }: { id: string | null; onClose: () => void; onPerson: (id: string) => void }) {
  const { snap, api, act, busy } = useStore()
  const confirm = useConfirm()
  const o = snap.opps.find((x) => x.id === id)
  const r = o && snap.restaurants.find((x) => x.id === o.restaurantId)
  if (!o || !r) return <Sheet open={false} onClose={onClose}>{null}</Sheet>
  const t = TONE[KIND[o.kind].tone]
  const roster = snap.bookings.filter((b) => b.oppId === o.id && b.status !== 'cancelled' && b.status !== 'declined')
  const upcoming = +new Date(o.start) > Date.now() && !o.cancelled
  return (
    <Sheet open onClose={onClose} tall>
      <div className={`mt-1 rounded-3xl p-4 ${t.soft}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className={`text-[14px] font-extrabold ${t.text}`}>
              {KIND[o.kind].icon} {KIND[o.kind].label}
            </div>
            <div className="text-2xl leading-tight font-extrabold">{o.kind === 'intro' ? 'Intro' : o.role}</div>
            <div className="font-bold text-ink/75">
              {fmtDay(o.start)} · {fmtTimeRange(o.start, o.end)} · {fmtDuration(o.start, o.end)}
            </div>
          </div>
          <div className="text-right">
            <div className="text-xl font-extrabold text-mint-deep">{fmtPay(o.payCents)}</div>
            <Fill o={o} />
          </div>
        </div>
        {(o.skills.length > 0 || o.notes) && (
          <div className="mt-2 flex flex-wrap gap-1 text-[13px] font-bold">
            {o.skills.map((s) => (
              <span key={s} className="rounded-full bg-white px-2 leading-6">
                {s}
              </span>
            ))}
            {o.notes && <span className="text-muted">{o.notes}</span>}
          </div>
        )}
      </div>
      <h3 className="mt-4 mb-2 px-1 text-lg font-extrabold">👥 {roster.length}</h3>
      <div className="flex flex-col gap-2">
        {roster.length ? roster.map((b) => <BookingRow key={b.id} b={b} o={o} onPerson={onPerson} />) : <Empty icon="🪑" text="No one yet" />}
      </div>
      {upcoming && o.filled < o.openings && (
        <>
          <h3 className="mt-5 mb-2 px-1 text-lg font-extrabold">✉️ Invite</h3>
          <InviteList o={o} r={r} onPerson={onPerson} />
        </>
      )}
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

export function PersonSheet({ id, restaurantId, onClose }: { id: string | null; restaurantId: string; onClose: () => void }) {
  const { snap, api, act, busy } = useStore()
  const person = usePerson()
  const [pick, setPick] = useState(false)
  if (!id) return <Sheet open={false} onClose={onClose}>{null}</Sheet>
  const p = person(id)
  const r = snap.restaurants.find((x) => x.id === restaurantId)!
  const t = travel(milesBetween(area(p.area), r))
  const here = snap.bookings
    .filter((b) => b.candidateId === id)
    .map((b) => ({ b, o: oppOf(snap, b)! }))
    .filter((x) => x.o?.restaurantId === restaurantId)
  const shifts = here.filter((x) => x.o.kind === 'shift' && x.b.status === 'attended').length
  const meets = here.filter((x) => x.o.kind !== 'shift' && x.b.status === 'attended').length
  const missed = here.filter((x) => x.b.status === 'no_show').length
  const eligible = isEligible(snap, restaurantId, id)
  const open = snap.opps.filter((o) => o.restaurantId === restaurantId && !o.cancelled && +new Date(o.start) > Date.now() && o.filled < o.openings && !bookingFor(snap, o.id, id))
  return (
    <Sheet open onClose={() => (setPick(false), onClose())} tall>
      <div className="flex items-center gap-3 pt-1">
        <div className="shrink-0 rounded-full bg-pink-soft">
          <Avatar look={p.look} size={84} anim="idle" />
        </div>
        <div className="min-w-0">
          <div className="flex items-center gap-2 text-2xl font-extrabold">
            {p.name}
            {p.demo && <Pill className="bg-lav-soft text-lav-deep">DEMO</Pill>}
          </div>
          <div className="font-semibold text-muted">
            📍 {area(p.area).name} · {t.icon} {t.mins} min
          </div>
        </div>
      </div>
      <div className="mt-3 rounded-3xl bg-white p-3 shadow-soft">
        <StageTrack current={stage(snap, restaurantId, id)} />
        <div className="mt-3 grid grid-cols-4 gap-1 text-center">
          {[
            ['⭐', pointsAt(snap, restaurantId, id)],
            ['👋', meets],
            ['🍳', shifts],
            ['🚫', missed],
          ].map(([icon, n]) => (
            <div key={icon as string} className="rounded-2xl bg-cream py-1">
              <div className="text-lg">{icon}</div>
              <div className="text-xl leading-tight font-extrabold">{n}</div>
            </div>
          ))}
        </div>
        <button
          onClick={() => act(`el-${id}`, () => api.setEligible(restaurantId, id, !eligible), eligible ? 'Locked' : 'Unlocked 🔓')}
          className={`mt-3 flex h-12 w-full items-center justify-center gap-2 rounded-2xl text-lg font-extrabold transition ${eligible ? 'bg-mint text-white shadow-[0_4px_0_#3fa47f]' : 'bg-line text-muted'}`}
        >
          {busy === `el-${id}` ? '…' : eligible ? '🔓 Shifts unlocked' : '🔒 Shifts locked'}
        </button>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        {p.roles.map((x) => (
          <Pill key={x} className="bg-pink-soft text-pink-deep">
            {ROLE_ICON[x]} {x}
          </Pill>
        ))}
        {p.skills.map((x) => (
          <Pill key={x} className="bg-lav-soft text-lav-deep">
            {x}
          </Pill>
        ))}
      </div>
      <div className="mt-3 rounded-3xl bg-white p-3 shadow-soft">
        <SlotGrid value={p.slots} readOnly />
      </div>
      <div className="mt-4 mb-4">
        {pick ? (
          <div className="flex flex-col gap-2">
            {open.length ? (
              open.map((o) => {
                const key = `inv-${o.id}-${id}`
                const blocked = o.kind === 'shift' && !eligible
                return (
                  <div key={o.id} className="flex items-center gap-2">
                    <div className="min-w-0 flex-1">
                      <OppRow o={o} onOpen={() => {}} />
                    </div>
                    <Btn size="sm" tone="pink" disabled={blocked} loading={busy === key} onClick={() => act(key, () => api.invite(o.id, id), 'Invited ✉️').then(() => setPick(false))}>
                      {blocked ? '🔒' : '✉️'}
                    </Btn>
                  </div>
                )
              })
            ) : (
              <Empty icon="📭" text="Nothing open" />
            )}
          </div>
        ) : (
          <Btn tone="pink" size="lg" className="w-full" onClick={() => setPick(true)}>
            ✉️ Invite
          </Btn>
        )}
      </div>
    </Sheet>
  )
}

const DEFAULT_TIMES: Record<Kind, [string, string]> = { intro: ['15:00', '15:30'], training: ['14:00', '16:00'], shift: ['17:00', '22:00'] }

export function PostSheet({ open, onClose, restaurantId }: { open: boolean; onClose: () => void; restaurantId: string }) {
  const { api, act, busy, say } = useStore()
  const [kind, setKind] = useState<Kind>('shift')
  const [role, setRole] = useState('Server')
  const [dayIdx, setDayIdx] = useState(1)
  const [from, setFrom] = useState(DEFAULT_TIMES.shift[0])
  const [to, setTo] = useState(DEFAULT_TIMES.shift[1])
  const [openings, setOpenings] = useState(1)
  const [pay, setPay] = useState('17')
  const [unpaid, setUnpaid] = useState(false)
  const [more, setMore] = useState(false)
  const [skills, setSkills] = useState<string[]>([])
  const [notes, setNotes] = useState('')
  const [lead, setLead] = useState(2)
  const [quest, setQuest] = useState(true)
  const today = startOfDay(new Date())
  const days = Array.from({ length: 14 }, (_, i) => addDays(today, i))

  const pickKind = (k: Kind) => {
    setKind(k)
    setFrom(DEFAULT_TIMES[k][0])
    setTo(DEFAULT_TIMES[k][1])
    setRole(k === 'intro' ? 'Any' : role === 'Any' ? 'Server' : role)
    setLead(k === 'intro' ? 1 : 2)
    if (k !== 'intro') setUnpaid(false)
  }

  const submit = async () => {
    const day = days[dayIdx]
    const start = at(day, from)
    let end = at(day, to)
    if (+new Date(end) <= +new Date(start)) end = at(addDays(day, 1), to)
    const input = {
      restaurantId, kind, role, start, end, openings,
      payCents: unpaid && kind === 'intro' ? 0 : Math.round(parseFloat(pay || '0') * 100),
      skills, notes, awardsPoint: quest,
      deadline: new Date(+new Date(start) - lead * HOUR).toISOString(),
    }
    const err = validatePost(input)
    if (err) return say(err, 'err')
    const ok = await act('post', () => api.post(input).then(() => true), 'Posted! 📣')
    if (ok) {
      setNotes('')
      onClose()
    }
  }

  return (
    <Sheet open={open} onClose={onClose} tall>
      <div className="flex flex-col gap-4 pt-1 pb-4">
        <div className="grid grid-cols-3 gap-2">
          {(['intro', 'training', 'shift'] as Kind[]).map((k) => {
            const t = TONE[KIND[k].tone]
            return (
              <button key={k} onClick={() => pickKind(k)} className={`flex h-20 flex-col items-center justify-center rounded-3xl border-[3px] text-[15px] font-extrabold transition active:scale-95 ${kind === k ? `${t.soft} ${t.border} ${t.text}` : 'border-transparent bg-white shadow-soft'}`}>
                <span className="text-3xl">{KIND[k].icon}</span>
                {KIND[k].label}
              </button>
            )
          })}
        </div>

        <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
          {(kind === 'intro' ? ['Any', ...ROLES] : ROLES).map((x) => (
            <Chip key={x} on={role === x} onClick={() => setRole(x)}>
              {ROLE_ICON[x]} {x}
            </Chip>
          ))}
        </div>

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
          <div className={`flex h-12 min-w-0 flex-1 items-center rounded-2xl border-2 bg-white px-3 ${unpaid ? 'border-line opacity-50' : 'border-mint'}`}>
            <span className="text-lg font-extrabold text-mint-deep">$</span>
            <input value={pay} disabled={unpaid} onChange={(e) => setPay(e.target.value.replace(/[^\d.]/g, ''))} inputMode="decimal" aria-label="Pay per hour" className="w-full min-w-0 bg-transparent px-1 text-lg font-extrabold outline-none" />
            <span className="font-bold text-muted">/h</span>
          </div>
          {kind === 'intro' && (
            <Chip tone="sun" on={unpaid} onClick={() => setUnpaid(!unpaid)}>
              Unpaid
            </Chip>
          )}
        </div>

        {more ? (
          <div className="anim-fade flex flex-col gap-3">
            <div className="flex flex-wrap gap-2">
              {SKILLS.map((s) => (
                <Chip key={s} tone="lav" on={skills.includes(s)} onClick={() => setSkills(skills.includes(s) ? skills.filter((x) => x !== s) : [...skills, s])}>
                  {s}
                </Chip>
              ))}
            </div>
            <input value={notes} onChange={(e) => setNotes(e.target.value.slice(0, 200))} placeholder="📝 Notes" className="h-12 rounded-2xl border-2 border-line bg-white px-4 font-semibold outline-none focus:border-pink" />
            <div className="flex flex-wrap items-center gap-2">
              <span className="font-extrabold">⏳</span>
              {[1, 2, 12, 24].map((h) => (
                <Chip key={h} tone="sky" on={lead === h} onClick={() => setLead(h)}>
                  {h}h
                </Chip>
              ))}
              <Chip tone="sun" on={quest} onClick={() => setQuest(!quest)}>
                ⭐ Quest
              </Chip>
            </div>
          </div>
        ) : (
          <button onClick={() => setMore(true)} className="self-start rounded-full px-2 text-[15px] font-bold text-muted">
            ＋ Skills · notes · deadline
          </button>
        )}

        <Btn size="lg" tone="pink" className="w-full" loading={busy === 'post'} onClick={submit}>
          📣 Post
        </Btn>
      </div>
    </Sheet>
  )
}
