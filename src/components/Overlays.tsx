import { useEffect, useMemo, useState } from 'react'
import type { NoteKind } from '../types'
import { useStore } from '../store'
import { bookingFor, oppOf } from '../lib/rules'
import { ago, fmtDay, fmtTime, HOUR } from '../lib/time'
import { Avatar } from './Avatar'
import { Btn, Empty, Icon, Sheet } from './ui'

export function Toast() {
  const { toast } = useStore()
  const [shown, setShown] = useState(toast)
  useEffect(() => {
    if (!toast) return
    setShown(toast)
    const t = setTimeout(() => setShown(null), 2300)
    return () => clearTimeout(t)
  }, [toast])
  if (!shown) return null
  return (
    <div className="pointer-events-none fixed inset-x-0 bottom-28 z-50 flex justify-center px-4" role="status">
      <div key={shown.id} className={`anim-pop rounded-full px-5 py-2.5 text-[17px] font-extrabold shadow-lift ${shown.tone === 'err' ? 'anim-shake bg-red text-white' : 'bg-ink text-white'}`}>
        {shown.text}
      </div>
    </div>
  )
}

const COLORS = ['#FF8FB1', '#6EC6FF', '#FFD25A', '#5CC49E', '#B79CFF', '#FFB38A']

export function Celebrate() {
  const { celebration, celebrate, snap, motion } = useStore()
  useEffect(() => {
    if (!celebration) return
    const t = setTimeout(() => celebrate(null), 3600)
    return () => clearTimeout(t)
  }, [celebration, celebrate])
  const bits = useMemo(() => Array.from({ length: 28 }, (_, i) => ({ left: Math.random() * 100, delay: Math.random() * 0.6, color: COLORS[i % COLORS.length], rot: Math.random() * 180 })), [celebration])
  if (!celebration || !snap.me) return null
  return (
    <div className="anim-fade fixed inset-0 z-50 flex items-center justify-center bg-ink/35 p-6" onClick={() => celebrate(null)}>
      {motion && bits.map((b, i) => <span key={i} className="confetti" style={{ left: `${b.left}%`, background: b.color, animationDelay: `${b.delay}s`, rotate: `${b.rot}deg` }} />)}
      <div className="anim-pop flex w-full max-w-xs flex-col items-center rounded-[32px] bg-cream px-6 pt-4 pb-6 text-center shadow-lift">
        <Avatar look={snap.me.look} size={120} anim="jump" />
        <div className="mt-1 text-3xl font-extrabold">{celebration.title}</div>
        {celebration.sub && <div className="mt-1 text-lg font-bold text-sun-deep">{celebration.sub}</div>}
        {celebration.badge && (
          <div className="anim-pop mt-3 flex items-center gap-2 rounded-2xl bg-sun-soft px-4 py-2" style={{ animationDelay: '0.5s' }}>
            <span className="text-3xl">{celebration.badge.icon}</span>
            <span className="text-lg font-extrabold">{celebration.badge.name}</span>
          </div>
        )}
      </div>
    </div>
  )
}

const NOTE_ICON: Record<NoteKind, string> = {
  booked: '✅', request: '🙋', approved: '✅', declined: '🙅', invite: '✉️', quest: '⭐', cancelled: '🚫',
  eligible: '🔓', noshow: '⚠️', withdrawn: '↩️', accepted: '🤝',
}

export function Bell({ onOpen }: { onOpen: () => void }) {
  const { snap } = useStore()
  const n = snap.notes.filter((x) => !x.read).length
  return (
    <button onClick={onOpen} aria-label="Notifications" className="relative flex h-12 w-12 items-center justify-center rounded-full bg-white text-ink shadow-soft active:scale-95">
      <span className={n ? 'anim-wiggle' : ''}>
        <Icon.bell />
      </span>
      {n > 0 && <span className="absolute -top-0.5 -right-0.5 flex h-5 min-w-5 items-center justify-center rounded-full bg-red px-1 text-[12px] font-extrabold text-white ring-2 ring-white">{n}</span>}
    </button>
  )
}

export function Notifications({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { snap, api, act, busy, refresh } = useStore()
  const me = snap.me
  useEffect(() => {
    if (open && snap.notes.some((n) => !n.read)) {
      const t = setTimeout(() => api.readNotes().then(refresh).catch(() => {}), 1200)
      return () => clearTimeout(t)
    }
  }, [open, snap.notes, api, refresh])
  if (!me) return null
  const now = Date.now()
  const reminders = snap.bookings
    .filter((b) => b.candidateId === me.id && b.status === 'confirmed')
    .map((b) => ({ b, o: oppOf(snap, b)! }))
    .filter(({ o }) => o && +new Date(o.start) > now && +new Date(o.start) - now < 24 * HOUR)
  return (
    <Sheet open={open} onClose={onClose}>
      <h2 className="px-1 pt-1 pb-3 text-2xl font-extrabold">🔔</h2>
      <div className="flex flex-col gap-2 pb-4">
        {reminders.map(({ o }) => {
          const r = snap.restaurants.find((x) => x.id === o.restaurantId)
          return (
            <div key={o.id} className="flex items-center gap-3 rounded-2xl bg-sky-soft p-3">
              <span className="text-2xl">⏰</span>
              <div className="flex-1 font-bold">
                {r?.name} · {fmtDay(o.start)} {fmtTime(o.start)}
              </div>
            </div>
          )
        })}
        {snap.notes.length === 0 && !reminders.length && <Empty icon="📭" text="All quiet" />}
        {snap.notes.map((n) => {
          const inv = n.kind === 'invite' && n.oppId ? bookingFor(snap, n.oppId, me.id) : undefined
          const key = `note-${n.id}`
          return (
            <div key={n.id} className={`flex items-center gap-3 rounded-2xl p-3 ${n.read ? 'bg-white' : 'bg-pink-soft'}`}>
              <span className="text-2xl">{NOTE_ICON[n.kind] ?? '•'}</span>
              <div className="min-w-0 flex-1">
                <div className="text-[15px] leading-snug font-bold">{n.text}</div>
                <div className="text-[13px] text-muted">{ago(n.at)}</div>
              </div>
              {inv?.status === 'invited' && (
                <div className="flex gap-1.5">
                  <Btn size="sm" tone="white" loading={busy === key} onClick={() => act(key, () => api.respond(inv.id, false), 'Declined')} label="Decline">
                    ✕
                  </Btn>
                  <Btn size="sm" tone="mint" loading={busy === key} onClick={() => act(key, () => api.respond(inv.id, true), 'Booked! 🎉')}>
                    ✓
                  </Btn>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </Sheet>
  )
}
