import type { Booking, Opportunity, Restaurant } from '../types'
import { useStore } from '../store'
import { bookingFor, canCheckIn, canCheckOut, check, icon, title } from '../lib/rules'
import { fmtDay, fmtDuration, fmtPay, fmtTimeRange } from '../lib/time'
import { Btn, Pill, useConfirm } from './ui'

export const STATUS: Record<Booking['status'], { label: string; cls: string }> = {
  pending: { label: '⏳ Requested', cls: 'bg-sun-soft text-sun-deep' },
  confirmed: { label: '✓ Confirmed', cls: 'bg-mint-soft text-mint-deep' },
  checked_in: { label: '🟢 Checked in', cls: 'bg-sky-soft text-sky-deep' },
  done: { label: '⭐ Done', cls: 'bg-line text-ink/70' },
  declined: { label: 'Declined', cls: 'bg-line text-muted' },
  cancelled: { label: 'Cancelled', cls: 'bg-line text-muted' },
}

export const bar = (o: Opportunity) => (o.kind === 'training' ? 'bg-lav' : 'bg-mint')

export const when = (o: Opportunity) => `${fmtDay(o.start)} · ${fmtTimeRange(o.start, o.end)}`

/** One training slot or shift, as the candidate sees it, with one obvious action. */
export function OppCard({ o, r, showPlace = false, onPlace }: { o: Opportunity; r: Restaurant; showPlace?: boolean; onPlace?: () => void }) {
  const { snap, act, api, busy } = useStore()
  const confirm = useConfirm()
  const me = snap.me
  if (!me) return null
  const b = bookingFor(snap, o.id, me.id)
  const left = Math.max(0, o.openings - o.filled)
  const key = `opp-${o.id}`
  const loading = busy === key

  let action: React.ReactNode
  if (b && canCheckIn(o, b, 'candidate')) {
    action = (
      <Btn size="sm" tone="mint" loading={loading} onClick={() => act(key, () => api.checkIn(b.id), 'Checked in 🟢')}>
        Check in
      </Btn>
    )
  } else if (b && canCheckOut(o, b, 'candidate')) {
    action = (
      <Btn size="sm" tone="pink" loading={loading} onClick={() => act(key, () => api.checkOut(b.id))}>
        Check out
      </Btn>
    )
  } else if (b && (b.status === 'pending' || b.status === 'confirmed') && +new Date(o.start) > Date.now()) {
    action = (
      <div className="flex items-center gap-1.5">
        <Pill className={STATUS[b.status].cls}>{STATUS[b.status].label}</Pill>
        <Btn size="sm" tone={confirm.armed === key ? 'red' : 'ghost'} loading={loading} label="Cancel" onClick={() => confirm.tap(key, () => act(key, () => api.cancelBooking(b.id), 'Cancelled'))}>
          {confirm.armed === key ? 'Sure?' : '✕'}
        </Btn>
      </div>
    )
  } else if (b) {
    action = <Pill className={STATUS[b.status].cls}>{STATUS[b.status].label}</Pill>
  } else {
    const res = check(me, o, snap)
    action = res.ok ? (
      <Btn size="sm" tone="pink" loading={loading} onClick={() => act(key, () => api.book(o.id), 'Requested ⏳')}>
        Book
      </Btn>
    ) : (
      <Pill className="bg-line text-muted">{res.text}</Pill>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl bg-white p-3.5 pl-5 shadow-soft ${b?.status === 'checked_in' ? 'ring-2 ring-sky' : ''}`}>
      <div className={`absolute top-0 bottom-0 left-0 w-2 ${bar(o)}`} />
      {showPlace && (
        <button onClick={onPlace} className="mb-1 flex items-center gap-1.5 text-[15px] font-bold text-ink/80">
          <span className="text-lg">{r.emoji}</span>
          {r.name}
        </button>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="truncate text-[17px] leading-tight font-extrabold">
            {icon(o)} {title(o)}
          </div>
          <div className="mt-1 text-[15px] font-semibold text-ink/75">
            {when(o)} · {fmtDuration(o.start, o.end)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className="text-lg leading-tight font-extrabold text-mint-deep">{fmtPay(o.payCents)}</div>
          {!b && <div className={`text-[13px] font-bold ${left === 0 ? 'text-red' : 'text-muted'}`}>{left === 0 ? 'Full' : `${left} left`}</div>}
        </div>
      </div>
      <div className="mt-2.5 flex items-end justify-between gap-2">
        <div className="min-w-0 text-[14px] text-muted">{o.notes}</div>
        <div className="shrink-0">{action}</div>
      </div>
    </div>
  )
}
