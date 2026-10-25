import type { Booking, Opportunity, Restaurant } from '../types'
import { useStore } from '../store'
import { bookingFor, check, KIND, match, ROLE_ICON } from '../lib/rules'
import { fmtDay, fmtDuration, fmtPay, fmtTimeRange } from '../lib/time'
import { Btn, Pill, useConfirm } from './ui'

export const TONE: Record<string, { bar: string; soft: string; text: string; border: string }> = {
  sky: { bar: 'bg-sky', soft: 'bg-sky-soft', text: 'text-sky-deep', border: 'border-sky' },
  lav: { bar: 'bg-lav', soft: 'bg-lav-soft', text: 'text-lav-deep', border: 'border-lav' },
  mint: { bar: 'bg-mint', soft: 'bg-mint-soft', text: 'text-mint-deep', border: 'border-mint' },
}

export const STATUS: Record<Booking['status'], { label: string; cls: string }> = {
  invited: { label: '✉️ Invited', cls: 'bg-pink-soft text-pink-deep' },
  pending: { label: '⏳ Requested', cls: 'bg-sun-soft text-sun-deep' },
  confirmed: { label: '✓ Booked', cls: 'bg-mint-soft text-mint-deep' },
  attended: { label: '⭐ Done', cls: 'bg-line text-ink/70' },
  no_show: { label: 'Missed', cls: 'bg-red-soft text-red' },
  declined: { label: 'Declined', cls: 'bg-line text-muted' },
  cancelled: { label: 'Cancelled', cls: 'bg-line text-muted' },
}

export function When({ o }: { o: Opportunity }) {
  return (
    <span>
      {fmtDay(o.start)} · {fmtTimeRange(o.start, o.end)}
    </span>
  )
}

/** One opportunity as the candidate sees it, with a single obvious action. */
export function OppCard({ o, r, showPlace = false, onPlace }: { o: Opportunity; r: Restaurant; showPlace?: boolean; onPlace?: () => void }) {
  const { snap, act, api, busy } = useStore()
  const confirm = useConfirm()
  const me = snap.me
  if (!me) return null
  const b = bookingFor(snap, o.id, me.id)
  const k = KIND[o.kind]
  const t = TONE[k.tone]
  const { reasons } = match(me, o, r, snap)
  const res = b ? null : check(me, o, r, snap)
  const final = b?.status === 'attended' || b?.status === 'no_show'
  const left = Math.max(0, o.openings - o.filled)
  const key = `opp-${o.id}`
  const loading = busy === key

  let action: React.ReactNode
  if (b?.status === 'invited') {
    action = (
      <div className="flex gap-2">
        <Btn size="sm" tone="white" loading={loading} onClick={() => act(key, () => api.respond(b.id, false), 'Declined')} label="Decline">
          ✕
        </Btn>
        <Btn size="sm" tone="mint" loading={loading} onClick={() => act(key, () => api.respond(b.id, true), 'Booked! 🎉')}>
          Accept
        </Btn>
      </div>
    )
  } else if (b && (b.status === 'pending' || b.status === 'confirmed') && +new Date(o.start) > Date.now()) {
    action = (
      <div className="flex items-center gap-2">
        <Pill className={STATUS[b.status].cls}>{STATUS[b.status].label}</Pill>
        <Btn size="sm" tone={confirm.armed === key ? 'red' : 'ghost'} loading={loading} onClick={() => confirm.tap(key, () => act(key, () => api.cancelBooking(b.id), 'Cancelled'))}>
          {confirm.armed === key ? 'Sure?' : '✕'}
        </Btn>
      </div>
    )
  } else if (b) {
    action = <Pill className={STATUS[b.status].cls}>{STATUS[b.status].label}</Pill>
  } else if (res?.ok) {
    action = (
      <Btn size="sm" tone={res.confirm ? 'pink' : 'sky'} loading={loading} onClick={() => act(key, () => api.book(o.id), (s) => (s === 'confirmed' ? 'Booked! 🎉' : 'Requested ⏳'))}>
        {res.confirm ? 'Book' : 'Request'}
      </Btn>
    )
  } else if (res) {
    action = (
      <Pill className="bg-line text-muted">
        {res.code === 'locked' ? '🔒 ' : res.code === 'full' ? '🈵 ' : ''}
        {res.text}
      </Pill>
    )
  }

  return (
    <div className={`relative overflow-hidden rounded-3xl border-2 bg-white p-3.5 pl-5 shadow-soft ${b?.status === 'pending' ? 'border-dashed border-sun' : b?.status === 'confirmed' ? t.border : b?.status === 'invited' ? 'border-pink' : 'border-transparent'}`}>
      <div className={`absolute top-0 bottom-0 left-0 w-2 ${t.bar}`} />
      {showPlace && (
        <button onClick={onPlace} className="mb-1 flex items-center gap-1.5 text-[15px] font-bold text-ink/80">
          <span className="text-lg">{r.emoji}</span>
          {r.name}
        </button>
      )}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-1.5 text-[17px] leading-tight font-extrabold">
            <span className={`rounded-lg px-1.5 text-[13px] ${t.soft} ${t.text}`}>
              {k.icon} {k.label}
            </span>
            <span className="truncate">{o.role === 'Any' ? '' : `${ROLE_ICON[o.role] ?? ''} ${o.role}`}</span>
          </div>
          <div className="mt-1 text-[15px] font-semibold text-ink/75">
            <When o={o} /> · {fmtDuration(o.start, o.end)}
          </div>
        </div>
        <div className="shrink-0 text-right">
          <div className={`text-lg leading-tight font-extrabold ${o.payCents ? 'text-mint-deep' : 'text-muted'}`}>{fmtPay(o.payCents)}</div>
          {!final && <div className={`text-[13px] font-bold ${left === 0 ? 'text-red' : 'text-muted'}`}>{left === 0 ? 'Full' : `${left} left`}</div>}
        </div>
      </div>
      <div className={`mt-2 flex-wrap gap-1 ${final ? 'hidden' : 'flex'}`}>
        {reasons.map((x) => (
          <span key={x.text} className={`rounded-full px-2 text-[12px] leading-6 font-bold ${x.ok ? 'bg-mint-soft text-mint-deep' : 'bg-line text-muted'}`}>
            {x.ok ? '✓ ' : ''}
            {x.text}
          </span>
        ))}
      </div>
      {(o.notes || action) && (
        <div className="mt-2.5 flex items-end justify-between gap-2">
          <div className="min-w-0 text-[14px] text-muted">{o.notes}</div>
          <div className="shrink-0">{action}</div>
        </div>
      )}
    </div>
  )
}
