import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import { addDays, dayKey, startOfDay } from '../lib/time'
import { Empty } from './ui'

export type CalTone = 'sky' | 'lav' | 'mint' | 'sun' | 'pink' | 'grey' | 'red'

export interface CalItem {
  id: string
  start: string
  tone: CalTone
  node: ReactNode
}

const DOT: Record<CalTone, string> = {
  sky: 'bg-sky', lav: 'bg-lav', mint: 'bg-mint', sun: 'bg-sun', pink: 'bg-pink', grey: 'bg-muted/50', red: 'bg-red',
}

export const LEGEND: { tone: CalTone; label: string }[] = [
  { tone: 'lav', label: 'Training' },
  { tone: 'mint', label: 'Shift' },
  { tone: 'grey', label: 'Done' },
]

export function Legend({ tones = LEGEND }: { tones?: { tone: CalTone; label: string }[] }) {
  return (
    <div className="no-scrollbar flex gap-3 overflow-x-auto px-1 text-[12px] font-bold text-muted">
      {tones.map((l) => (
        <span key={l.label} className="flex shrink-0 items-center gap-1">
          <span className={`h-2.5 w-2.5 rounded-full ${DOT[l.tone]}`} />
          {l.label}
        </span>
      ))}
    </div>
  )
}

export function Calendar({ items, emptyIcon = '🌤️', emptyText = 'Free day', pastDays = 7 }: { items: CalItem[]; emptyIcon?: string; emptyText?: string; pastDays?: number }) {
  const today = startOfDay(new Date())
  // Open on today, or the next day that has something on it.
  const [sel, setSel] = useState(() => {
    const t = dayKey(today)
    const next = items.map((it) => dayKey(it.start)).filter((k) => k >= t).sort()[0]
    return items.some((it) => dayKey(it.start) === t) || !next ? t : next
  })
  const strip = useRef<HTMLDivElement>(null)
  const todayRef = useRef<HTMLButtonElement>(null)
  const days = useMemo(() => Array.from({ length: pastDays + 21 }, (_, i) => addDays(today, i - pastDays)), [pastDays, today.getTime()]) // eslint-disable-line react-hooks/exhaustive-deps
  const byDay = useMemo(() => {
    const m = new Map<string, CalItem[]>()
    items.forEach((it) => {
      const k = dayKey(it.start)
      m.set(k, [...(m.get(k) ?? []), it])
    })
    m.forEach((list) => list.sort((a, b) => +new Date(a.start) - +new Date(b.start)))
    return m
  }, [items])

  useEffect(() => {
    const s = strip.current
    const t = todayRef.current
    if (s && t) s.scrollLeft = t.offsetLeft - 8
  }, [])

  const list = byDay.get(sel) ?? []
  return (
    <div className="flex flex-col gap-3">
      <div ref={strip} className="no-scrollbar -mx-4 flex gap-1.5 overflow-x-auto px-4 py-1">
        {days.map((d) => {
          const k = dayKey(d)
          const its = byDay.get(k) ?? []
          const on = k === sel
          const isToday = k === dayKey(today)
          return (
            <button
              key={k}
              ref={isToday ? todayRef : undefined}
              onClick={() => setSel(k)}
              className={`flex h-[74px] w-[50px] shrink-0 flex-col items-center justify-center rounded-2xl transition ${on ? 'bg-pink text-white shadow-[0_4px_0_#e0729a]' : isToday ? 'bg-pink-soft' : 'bg-white shadow-soft'} ${d < today && !on ? 'opacity-55' : ''}`}
            >
              <span className="text-[12px] font-bold uppercase opacity-80">{d.toLocaleDateString('en-US', { weekday: 'short' })}</span>
              <span className="text-xl leading-tight font-extrabold">{d.getDate()}</span>
              <span className="flex h-2 gap-0.5">
                {its.slice(0, 3).map((it) => (
                  <span key={it.id} className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-white' : DOT[it.tone]}`} />
                ))}
              </span>
            </button>
          )
        })}
      </div>
      <div className="flex flex-col gap-2.5">
        {list.length ? list.map((it) => <div key={it.id}>{it.node}</div>) : <Empty icon={emptyIcon} text={emptyText} />}
      </div>
    </div>
  )
}
