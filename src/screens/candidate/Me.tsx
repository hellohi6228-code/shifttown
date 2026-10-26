import { useEffect, useRef, useState } from 'react'
import type { Profile } from '../../types'
import { useStore } from '../../store'
import { area } from '../../lib/geo'
import { BADGES, badges, level, oppOf, pointsAt, rating, title, unlocked } from '../../lib/rules'
import { fmtDay, fmtDuration, minutes } from '../../lib/time'
import { Avatar } from '../../components/Avatar'
import { AvatarEditor } from '../../components/AvatarEditor'
import { AreaPicker, RadiusPicker, RolePicker, Section, SkillPicker, SlotGrid } from '../../components/Prefs'
import { Btn, Chip, Icon, Pill, Sheet } from '../../components/ui'

/** Edits save themselves — no save buttons. */
export function useAutosave(me: Profile) {
  const { api, refresh } = useStore()
  const [draft, setDraft] = useState(me)
  const latest = useRef(me)
  const timer = useRef<number | undefined>(undefined)
  useEffect(() => {
    setDraft(me)
    latest.current = me
  }, [me.id]) // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => clearTimeout(timer.current), [])
  const update = (patch: Partial<Profile>) => {
    const next = { ...latest.current, ...patch }
    latest.current = next
    setDraft(next)
    clearTimeout(timer.current)
    timer.current = window.setTimeout(() => {
      const { id: _id, demo: _demo, ...input } = next
      api.saveProfile(input).then(refresh).catch(() => {})
    }, 450)
  }
  return [draft, update] as const
}

export function DemoPanel() {
  const { api, resetSession, snap, refresh, say } = useStore()
  if (!api.demo) return null
  const self = api.demo.selfId()
  const people = api.demo.people()
  return (
    <section className="rounded-3xl border-2 border-dashed border-lav bg-lav-soft/60 p-3">
      <div className="mb-2 flex items-center justify-between">
        <Pill className="bg-lav text-white">DEMO</Pill>
        <Btn
          size="sm"
          tone="white"
          onClick={() => {
            api.demo!.reset()
            refresh().then(() => say('Demo reset'))
          }}
        >
          ↺ Reset
        </Btn>
      </div>
      <div className="no-scrollbar -mx-3 flex gap-2 overflow-x-auto px-3">
        {[{ id: self, name: 'You', look: null as Profile['look'] | null }, ...people.map((p) => ({ id: p.id, name: p.name, look: p.look }))].map((p) => (
          <button
            key={p.id}
            onClick={() => {
              api.demo!.actAs(p.id)
              resetSession()
            }}
            className={`flex w-16 shrink-0 flex-col items-center rounded-2xl p-1 ${snap.me?.id === p.id ? 'bg-white shadow-soft' : ''}`}
          >
            {p.look ? <Avatar look={p.look} head size={44} anim="none" /> : <span className="flex h-11 w-11 items-center justify-center text-2xl">🙂</span>}
            <span className="text-[13px] font-bold">{p.name}</span>
          </button>
        ))}
      </div>
    </section>
  )
}

export function Me() {
  const { snap, setMode, motion, setMotion } = useStore()
  const me = snap.me!
  const [draft, update] = useAutosave(me)
  const [editing, setEditing] = useState(false)
  const [badge, setBadge] = useState<string | null>(null)

  const mine = snap.quests.filter((q) => q.candidateId === me.id)
  const lv = level(mine.length)
  const earned = badges(snap, me.id)
  const done = snap.bookings
    .filter((b) => b.candidateId === me.id && b.status === 'done')
    .map((b) => ({ b, o: oppOf(snap, b)! }))
    .filter((x) => x.o)
    .sort((a, b) => +new Date(b.o.start) - +new Date(a.o.start))
  const shifts = done.filter((x) => x.o.kind === 'shift')
  const trainings = done.filter((x) => x.o.kind === 'training')
  const hours = Math.round(shifts.reduce((s, x) => s + minutes(x.o.start, x.o.end), 0) / 60)
  const stars = rating(snap.reviews, me.id)
  const places = snap.restaurants
    .filter((r) => unlocked(snap, r.id, me.id))
    .map((r) => ({ r, pts: pointsAt(snap, r.id, me.id) }))
    .sort((a, b) => b.pts - a.pts)

  return (
    <div className="no-scrollbar h-full overflow-y-auto">
      <div className="pt-safe px-4 pb-8">
        <div className="flex flex-col items-center pt-2">
          <div className="relative">
            <div className="absolute inset-x-2 top-8 bottom-4 rounded-full bg-pink-soft" />
            <Avatar look={draft.look} size={128} anim="idle" className="relative" />
            <button onClick={() => setEditing(true)} aria-label="Edit look" className="absolute top-3 -right-3 flex h-11 w-11 items-center justify-center rounded-full bg-white text-pink-deep shadow-soft active:scale-95">
              <Icon.edit size={20} />
            </button>
          </div>
          <div className="mt-1 text-3xl font-extrabold">{draft.name}</div>
          <div className="mt-2 w-full max-w-xs">
            <div className="flex items-center justify-between text-[15px] font-extrabold">
              <span className="rounded-full bg-sun px-2.5">Lv {lv.lv}</span>
              <span className="text-muted">{lv.next === null ? 'MAX' : `${lv.n} / ${lv.next} ⭐`}</span>
            </div>
            <div className="mt-1 h-3.5 overflow-hidden rounded-full bg-line">
              <div className="h-full rounded-full bg-gradient-to-r from-sun to-pink transition-all" style={{ width: `${Math.max(6, lv.pct * 100)}%` }} />
            </div>
          </div>
        </div>

        <div className="mt-4 grid grid-cols-4 gap-2">
          {[
            ['🎓', trainings.length, 'Trainings'],
            ['🍳', shifts.length, 'Shifts'],
            ['⏱️', hours, 'Hours'],
            ['★', stars.avg === null ? '–' : stars.avg.toFixed(1), stars.count === 1 ? '1 review' : `${stars.count} reviews`],
          ].map(([icon, n, label]) => (
            <div key={label as string} className="flex flex-col items-center rounded-3xl bg-white py-2.5 shadow-soft">
              <span className="text-xl">{icon}</span>
              <span className="text-2xl leading-tight font-extrabold">{n}</span>
              <span className="text-[13px] font-bold text-muted">{label}</span>
            </div>
          ))}
        </div>

        <div className="mt-5 flex flex-col gap-5">
          <Section icon="🏅" title="Badges">
            <div className="grid grid-cols-4 gap-2">
              {BADGES.map((b) => {
                const on = earned.has(b.id)
                return (
                  <button key={b.id} onClick={() => setBadge(badge === b.id ? null : b.id)} className={`flex aspect-square flex-col items-center justify-center rounded-3xl transition active:scale-95 ${on ? 'bg-sun-soft shadow-soft' : 'bg-line/60'} ${badge === b.id ? 'ring-4 ring-sun' : ''}`}>
                    <span className={`text-3xl ${on ? '' : 'opacity-30 grayscale'}`}>{b.icon}</span>
                    <span className={`text-[11px] leading-tight font-bold ${on ? '' : 'text-muted'}`}>{b.name}</span>
                  </button>
                )
              })}
            </div>
            {badge && <div className="anim-fade rounded-2xl bg-white px-3 py-2 text-center font-bold shadow-soft">{BADGES.find((b) => b.id === badge)!.rule}</div>}
          </Section>

          {places.length > 0 && (
            <Section icon="🔓" title="Unlocked">
              <div className="flex flex-col gap-2">
                {places.map(({ r, pts }) => (
                  <div key={r.id} className="flex items-center gap-3 rounded-2xl bg-white px-3 py-2.5 shadow-soft">
                    <span className="text-2xl">{r.emoji}</span>
                    <span className="flex-1 truncate font-bold">{r.name}</span>
                    <span className="min-w-12 text-right font-extrabold text-sun-deep">⭐{pts}</span>
                  </div>
                ))}
              </div>
            </Section>
          )}

          {done.length > 0 && (
            <Section icon="📜" title="History">
              <div className="flex flex-col gap-1.5">
                {done.slice(0, 20).map(({ b, o }) => {
                  const r = snap.restaurants.find((x) => x.id === o.restaurantId)
                  return (
                    <div key={b.id} className="flex items-center gap-2 rounded-2xl bg-white px-3 py-2 text-[15px] shadow-soft">
                      <span>{r?.emoji}</span>
                      <span className="flex-1 truncate font-bold">
                        {title(o)} · {r?.name}
                      </span>
                      <span className="text-muted">
                        {fmtDay(o.start)} · {fmtDuration(o.start, o.end)}
                      </span>
                      <span>{snap.reviews.find((v) => v.bookingId === b.id) ? '★'.repeat(snap.reviews.find((v) => v.bookingId === b.id)!.stars) : '✅'}</span>
                    </div>
                  )
                })}
              </div>
            </Section>
          )}

          <Section icon="🧑‍🍳" title="Roles">
            <RolePicker value={draft.roles} onChange={(roles) => update({ roles })} />
          </Section>
          <Section icon="🗓️" title="When">
            <div className="rounded-3xl bg-white p-3 shadow-soft">
              <SlotGrid value={draft.slots} onChange={(slots) => update({ slots })} />
            </div>
          </Section>
          <Section icon="📍" title={area(draft.area).name}>
            <AreaPicker value={draft.area} onChange={(a) => update({ area: a })} />
            <RadiusPicker value={draft.radiusMi} onChange={(radiusMi) => update({ radiusMi })} />
          </Section>
          <Section icon="🎒" title="Skills">
            <SkillPicker value={draft.skills} onChange={(skills) => update({ skills })} />
          </Section>

          <div className="flex flex-wrap gap-2">
            <Btn tone="sky" onClick={() => setMode('manager')}>
              🏪 My restaurant
            </Btn>
            <Chip tone="lav" on={motion} onClick={() => setMotion(!motion)}>
              ✨ Motion
            </Chip>
          </div>
          <DemoPanel />
        </div>
      </div>

      <Sheet open={editing} onClose={() => setEditing(false)}>
        <div className="pb-4">
          <AvatarEditor look={draft.look} onChange={(look) => update({ look })} name={draft.name} onName={(name) => update({ name })} />
          <Btn tone="pink" size="lg" className="mt-4 w-full" onClick={() => setEditing(false)}>
            <Icon.check />
          </Btn>
        </div>
      </Sheet>
    </div>
  )
}
