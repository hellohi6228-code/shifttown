import { useEffect, useRef, useState, type ReactNode } from 'react'

const I = ({ d, size = 24, sw = 2.4 }: { d: string; size?: number; sw?: number }) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={sw} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
    <path d={d} />
  </svg>
)

export const Icon = {
  map: (p: { size?: number }) => <I {...p} d="M9 4 3 6.5v13.5l6-2.5 6 2.5 6-2.5V4l-6 2.5L9 4Zm0 0v13.5m6-11v13.5" />,
  cal: (p: { size?: number }) => <I {...p} d="M4 7a2 2 0 0 1 2-2h12a2 2 0 0 1 2 2v12a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V7Zm0 3h16M8 3v4m8-4v4" />,
  me: (p: { size?: number }) => <I {...p} d="M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8Zm-7 9a7 7 0 0 1 14 0" />,
  bell: (p: { size?: number }) => <I {...p} d="M6 16V11a6 6 0 1 1 12 0v5l1.5 2h-15L6 16Zm4 4a2 2 0 0 0 4 0" />,
  plus: (p: { size?: number }) => <I {...p} sw={3} d="M12 5v14M5 12h14" />,
  search: (p: { size?: number }) => <I {...p} d="M11 18a7 7 0 1 0 0-14 7 7 0 0 0 0 14Zm5-2 4 4" />,
  x: (p: { size?: number }) => <I {...p} sw={2.8} d="M6 6l12 12M18 6 6 18" />,
  check: (p: { size?: number }) => <I {...p} sw={3} d="m5 12.5 4.5 4.5L19 7.5" />,
  back: (p: { size?: number }) => <I {...p} sw={2.8} d="M15 5 8 12l7 7" />,
  people: (p: { size?: number }) => <I {...p} d="M9 11a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7Zm-6 9a6 6 0 0 1 12 0m1-9a3 3 0 1 0 0-6m2 15a5 5 0 0 0-3-4.6" />,
  board: (p: { size?: number }) => <I {...p} d="M4 11.5 12 4l8 7.5V20a1 1 0 0 1-1 1h-4.5v-5.5h-5V21H5a1 1 0 0 1-1-1v-8.5Z" />,
  swap: (p: { size?: number }) => <I {...p} d="M7 4 3 8l4 4M3 8h13m1 4 4 4-4 4m4-4H8" />,
  clip: (p: { size?: number }) => <I {...p} d="M9 4h6v3H9V4Zm-3 1h2m8 0h2v15H6V5" />,
  pin: (p: { size?: number }) => <I {...p} d="M12 21s7-6.2 7-11.5a7 7 0 1 0-14 0C5 14.8 12 21 12 21Zm0-9a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5Z" />,
  edit: (p: { size?: number }) => <I {...p} d="m14 5 5 5M4 20l1-5L15.5 4.5a2.1 2.1 0 0 1 3 3L8 18l-4 2Z" />,
  dice: (p: { size?: number }) => <I {...p} d="M5 4h14a1 1 0 0 1 1 1v14a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V5a1 1 0 0 1 1-1Zm3.5 4.5h.01m7 0h.01M12 12h.01m-3.5 3.5h.01m7 0h.01" />,
}

type Tone = 'pink' | 'mint' | 'sky' | 'sun' | 'lav' | 'white' | 'ghost' | 'red' | 'ink'

const TONES: Record<Tone, string> = {
  pink: 'bg-pink text-white shadow-[0_4px_0_#e0729a]',
  mint: 'bg-mint text-white shadow-[0_4px_0_#3fa47f]',
  sky: 'bg-sky text-white shadow-[0_4px_0_#4aa6e0]',
  sun: 'bg-sun text-ink shadow-[0_4px_0_#e2b33e]',
  lav: 'bg-lav text-white shadow-[0_4px_0_#9a80e6]',
  red: 'bg-red text-white shadow-[0_4px_0_#e05555]',
  ink: 'bg-ink text-white shadow-[0_4px_0_#221f33]',
  white: 'bg-white text-ink shadow-[0_4px_0_#e8e3f0] border border-line',
  ghost: 'bg-transparent text-muted',
}

export function Btn({
  children, tone = 'pink', size = 'md', onClick, disabled, loading, className = '', type = 'button', label,
}: {
  children: ReactNode
  tone?: Tone
  size?: 'sm' | 'md' | 'lg'
  onClick?: () => void
  disabled?: boolean
  loading?: boolean
  className?: string
  type?: 'button' | 'submit'
  label?: string
}) {
  const sz = size === 'lg' ? 'h-14 px-6 text-xl rounded-2xl' : size === 'sm' ? 'h-9 px-3.5 text-[15px] rounded-xl' : 'h-11 px-5 text-[17px] rounded-2xl'
  return (
    <button
      type={type}
      aria-label={label}
      onClick={onClick}
      disabled={disabled || loading}
      className={`inline-flex items-center justify-center gap-1.5 font-bold whitespace-nowrap transition active:translate-y-[3px] active:shadow-none disabled:opacity-45 disabled:active:translate-y-0 ${TONES[tone]} ${sz} ${className}`}
    >
      {loading ? <span className="inline-block h-5 w-5 animate-spin rounded-full border-[3px] border-current border-t-transparent" /> : children}
    </button>
  )
}

export function Chip({ on, onClick, children, tone = 'pink', className = '' }: { on: boolean; onClick: () => void; children: ReactNode; tone?: 'pink' | 'mint' | 'sky' | 'lav' | 'sun'; className?: string }) {
  const onCls: Record<string, string> = {
    pink: 'bg-pink-soft border-pink text-pink-deep',
    mint: 'bg-mint-soft border-mint text-mint-deep',
    sky: 'bg-sky-soft border-sky text-sky-deep',
    lav: 'bg-lav-soft border-lav text-lav-deep',
    sun: 'bg-sun-soft border-sun text-sun-deep',
  }
  return (
    <button
      type="button"
      aria-pressed={on}
      onClick={onClick}
      className={`h-10 shrink-0 rounded-full border-2 px-3.5 text-[15px] font-semibold transition active:scale-95 ${on ? onCls[tone] : 'border-line bg-white text-ink/75'} ${className}`}
    >
      {children}
    </button>
  )
}

export function Sheet({ open, onClose, children, tall = false }: { open: boolean; onClose: () => void; children: ReactNode; tall?: boolean }) {
  const ref = useRef<HTMLDivElement>(null)
  const start = useRef<number | null>(null)
  const [drag, setDrag] = useState(0)
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose()
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])
  useEffect(() => setDrag(0), [open])
  if (!open) return null
  return (
    <div className="fixed inset-0 z-40 flex flex-col justify-end" role="dialog" aria-modal>
      <div className="anim-fade absolute inset-0 bg-ink/30" onClick={onClose} />
      <div
        ref={ref}
        style={{ transform: drag ? `translateY(${drag}px)` : undefined }}
        className={`anim-up relative mx-auto flex w-full max-w-xl flex-col rounded-t-[30px] bg-cream shadow-lift ${tall ? 'h-[92dvh]' : 'max-h-[88dvh]'}`}
      >
        <div
          className="flex shrink-0 cursor-grab justify-center pt-2.5 pb-1.5 touch-none"
          onPointerDown={(e) => {
            start.current = e.clientY
            ;(e.target as HTMLElement).setPointerCapture(e.pointerId)
          }}
          onPointerMove={(e) => start.current !== null && setDrag(Math.max(0, e.clientY - start.current))}
          onPointerUp={() => {
            if (drag > 90) onClose()
            else setDrag(0)
            start.current = null
          }}
        >
          <div className="h-1.5 w-12 rounded-full bg-ink/15" />
        </div>
        <div className="no-scrollbar min-h-0 flex-1 overflow-y-auto overscroll-contain px-4 pb-safe">{children}</div>
      </div>
    </div>
  )
}

export function Pill({ children, className = '' }: { children: ReactNode; className?: string }) {
  return <span className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[13px] leading-6 font-bold ${className}`}>{children}</span>
}

export function Empty({ icon, text }: { icon: string; text: string }) {
  return (
    <div className="flex flex-col items-center gap-1 py-10 text-center text-muted">
      <div className="anim-float text-5xl">{icon}</div>
      <div className="text-lg font-semibold">{text}</div>
    </div>
  )
}

export function TabBar<T extends string>({ tabs, value, onChange }: { tabs: { id: T; icon: ReactNode; label: string; dot?: number }[]; value: T; onChange: (t: T) => void }) {
  return (
    <nav className="pb-safe relative z-20 border-t border-line bg-white/95 backdrop-blur">
      <div className="mx-auto flex max-w-xl">
        {tabs.map((t) => (
          <button
            key={t.id}
            onClick={() => onChange(t.id)}
            aria-label={t.label}
            className={`relative flex flex-1 flex-col items-center pt-2 pb-0.5 text-[12px] font-bold transition ${value === t.id ? 'text-pink-deep' : 'text-muted'}`}
          >
            <span className={`flex h-9 w-14 items-center justify-center rounded-full transition ${value === t.id ? 'bg-pink-soft' : ''}`}>{t.icon}</span>
            {t.label}
            {t.dot ? <span className="absolute top-1.5 right-[calc(50%-24px)] h-2.5 w-2.5 rounded-full bg-red ring-2 ring-white" /> : null}
          </button>
        ))}
      </div>
    </nav>
  )
}

/** Tap once to arm, tap again within 3s to confirm. No dialogs. */
export function useConfirm() {
  const [armed, setArmed] = useState<string | null>(null)
  useEffect(() => {
    if (!armed) return
    const t = setTimeout(() => setArmed(null), 3000)
    return () => clearTimeout(t)
  }, [armed])
  return {
    armed,
    tap(key: string, run: () => void) {
      if (armed === key) {
        setArmed(null)
        run()
      } else setArmed(key)
    },
  }
}

export function Segmented<T extends string>({ value, options, onChange }: { value: T; options: { id: T; label: ReactNode }[]; onChange: (v: T) => void }) {
  return (
    <div className="flex rounded-2xl bg-line/70 p-1">
      {options.map((o) => (
        <button
          key={o.id}
          onClick={() => onChange(o.id)}
          className={`h-9 flex-1 rounded-xl text-[15px] font-bold transition ${value === o.id ? 'bg-white text-ink shadow-soft' : 'text-muted'}`}
        >
          {o.label}
        </button>
      ))}
    </div>
  )
}
