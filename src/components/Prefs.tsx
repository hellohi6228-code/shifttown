import { AREAS } from '../lib/geo'
import { ROLE_ICON, ROLES, SKILLS } from '../lib/rules'
import { DAY_SHORT, DAYS, PARTS } from '../lib/time'
import { Chip } from './ui'

const toggle = (list: string[], v: string) => (list.includes(v) ? list.filter((x) => x !== v) : [...list, v])

export function RolePicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {ROLES.map((r) => (
        <Chip key={r} on={value.includes(r)} onClick={() => onChange(toggle(value, r))}>
          {ROLE_ICON[r]} {r}
        </Chip>
      ))}
    </div>
  )
}

export function SkillPicker({ value, onChange }: { value: string[]; onChange: (v: string[]) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {SKILLS.map((s) => (
        <Chip key={s} tone="lav" on={value.includes(s)} onClick={() => onChange(toggle(value, s))}>
          {s}
        </Chip>
      ))}
    </div>
  )
}

export function SlotGrid({ value, onChange, readOnly = false }: { value: string[]; onChange?: (v: string[]) => void; readOnly?: boolean }) {
  const set = (keys: string[]) => {
    if (readOnly || !onChange) return
    const allOn = keys.every((k) => value.includes(k))
    onChange(allOn ? value.filter((v) => !keys.includes(v)) : [...new Set([...value, ...keys])])
  }
  return (
    <div className="grid grid-cols-[36px_repeat(7,1fr)] gap-1.5">
      <span />
      {DAYS.map((d, i) => (
        <button key={d} disabled={readOnly} onClick={() => set(PARTS.map((p) => `${d}-${p.id}`))} className="h-7 text-[13px] font-extrabold text-muted">
          {DAY_SHORT[i]}
        </button>
      ))}
      {PARTS.map((p) => (
        <div key={p.id} className="contents">
          <button disabled={readOnly} onClick={() => set(DAYS.map((d) => `${d}-${p.id}`))} className="text-lg">
            {p.label}
          </button>
          {DAYS.map((d) => {
            const k = `${d}-${p.id}`
            const on = value.includes(k)
            return (
              <button
                key={k}
                disabled={readOnly}
                aria-label={k}
                aria-pressed={on}
                onClick={() => set([k])}
                className={`aspect-square rounded-xl transition active:scale-90 ${on ? 'bg-mint shadow-[0_3px_0_#3fa47f]' : 'bg-line/80'}`}
              />
            )
          })}
        </div>
      ))}
    </div>
  )
}

export function AreaPicker({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {AREAS.map((a) => (
        <Chip key={a.id} tone="sky" on={value === a.id} onClick={() => onChange(a.id)}>
          {a.name}
        </Chip>
      ))}
    </div>
  )
}

export function RadiusPicker({ value, onChange }: { value: number; onChange: (v: number) => void }) {
  return (
    <div className="flex gap-2">
      {[1, 2.5, 5].map((m) => (
        <Chip key={m} tone="sky" on={value === m} onClick={() => onChange(m)}>
          {m === 1 ? '🚶' : m === 2.5 ? '🚲' : '🚌'} {m} mi
        </Chip>
      ))}
    </div>
  )
}

export function Section({ icon, title, children }: { icon: string; title: string; children: React.ReactNode }) {
  return (
    <section className="flex flex-col gap-2">
      <h3 className="px-1 text-lg font-extrabold">
        {icon} {title}
      </h3>
      {children}
    </section>
  )
}
