import { useState } from 'react'
import { useStore, type Mode } from '../store'
import { platform } from '../auth/native'
import { randomLook, randomName } from '../lib/look'
import { DAYS } from '../lib/time'
import { AvatarEditor } from '../components/AvatarEditor'
import { AreaPicker, RolePicker, Section, SlotGrid } from '../components/Prefs'
import { TownMap } from '../components/TownMap'
import { Btn, Icon } from '../components/ui'

export function Logo({ small = false }: { small?: boolean }) {
  return (
    <div className="flex items-center justify-center gap-2">
      <svg viewBox="0 0 512 512" width={small ? 36 : 54} height={small ? 36 : 54} aria-hidden>
        <rect width="512" height="512" rx="112" fill="#FFE3EC" />
        <path d="M256 120 412 210 256 300 100 210Z" fill="#B8F0D8" />
        <path d="M100 210v100l156 90V300Z" fill="#7FD8B4" />
        <path d="M412 210v100l-156 90V300Z" fill="#5CC49E" />
        <path d="M196 236 256 202l60 34v70l-60 34-60-34Z" fill="#FFF6D6" />
        <path d="M196 236l60 34 60-34-60-34Z" fill="#FF8FB1" />
        <circle cx="256" cy="150" r="34" fill="#FFD25A" />
      </svg>
      <div className={`${small ? 'text-2xl' : 'text-[40px]'} leading-none font-extrabold tracking-tight`}>
        Shift<span className="text-pink-deep">Town</span>
      </div>
    </div>
  )
}

function RoleCard({ icon, label, tone, onClick, loading }: { icon: string; label: string; tone: 'pink' | 'sky'; onClick: () => void; loading: boolean }) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex h-[76px] items-center gap-4 rounded-3xl px-5 text-left text-[22px] font-extrabold text-white transition active:translate-y-1 active:shadow-none ${tone === 'pink' ? 'bg-pink shadow-[0_6px_0_#e0729a]' : 'bg-sky shadow-[0_6px_0_#4aa6e0]'}`}
    >
      <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-white/30 text-3xl">{icon}</span>
      <span className="flex-1">{label}</span>
      {loading ? <span className="h-6 w-6 animate-spin rounded-full border-[3px] border-white border-t-transparent" /> : <span className="text-2xl">→</span>}
    </button>
  )
}

export function Welcome() {
  const { signIn, busy, motion } = useStore()
  const [role, setRole] = useState<Mode | null>(null)
  // Apple requires its own button on iOS; Android goes straight to the Google Play account sheet.
  const pick = (m: Mode) => (platform === 'ios' ? setRole(m) : signIn(m))
  return (
    <div className="relative h-full overflow-hidden">
      <TownMap restaurants={[]} onSelect={() => {}} motion={motion} labels={false} />
      <div className="pointer-events-none absolute inset-0 bg-gradient-to-b from-cream/10 via-cream/40 to-cream" />
      <div className="pb-safe absolute inset-x-0 bottom-0 mx-auto flex max-w-md flex-col gap-4 px-5 pb-6">
        <div className="anim-pop">
          <Logo />
          <div className="mt-1 text-center text-lg font-bold text-muted">Ithaca 🏞️</div>
        </div>
        {role ? (
          <div className="anim-pop flex flex-col gap-3">
            <button onClick={() => signIn(role)} className="flex h-14 items-center justify-center gap-2 rounded-2xl bg-black text-[19px] font-semibold text-white active:opacity-80">
              <svg width="18" height="22" viewBox="0 0 17 20" fill="currentColor" aria-hidden>
                <path d="M14.1 10.6c0-2.6 2.1-3.8 2.2-3.9-1.2-1.8-3.1-2-3.7-2-1.6-.2-3.1.9-3.9.9-.8 0-2-.9-3.4-.9C3.6 4.8 2 5.8 1.1 7.4c-1.9 3.3-.5 8.1 1.3 10.7.9 1.3 1.9 2.7 3.3 2.7 1.3-.1 1.8-.9 3.4-.9 1.6 0 2 .9 3.4.8 1.4 0 2.3-1.3 3.1-2.6 1-1.5 1.4-2.9 1.4-3 0 0-2.9-1.1-2.9-4.5ZM11.6 3c.7-.9 1.2-2 1.1-3.2-1 0-2.3.7-3 1.6-.7.8-1.3 2-1.1 3.1 1.1.1 2.3-.6 3-1.5Z" />
              </svg>
              Sign in with Apple
            </button>
            <Btn tone="ghost" onClick={() => setRole(null)}>
              <Icon.back size={18} />
            </Btn>
          </div>
        ) : (
          <div className="flex flex-col gap-3.5">
            <RoleCard icon="🍳" label="Find shifts" tone="pink" onClick={() => pick('candidate')} loading={busy === 'signin'} />
            <RoleCard icon="🏪" label="I run a restaurant" tone="sky" onClick={() => pick('manager')} loading={busy === 'signin'} />
          </div>
        )}
      </div>
    </div>
  )
}

const DEFAULT_SLOTS = [...DAYS.map((d) => `${d}-eve`), 'sat-pm', 'sun-pm']

export function Onboard() {
  const { mode, api, act, busy } = useStore()
  const [step, setStep] = useState<'look' | 'prefs'>('look')
  const [look, setLook] = useState(randomLook)
  const [name, setName] = useState(randomName)
  const [roles, setRoles] = useState<string[]>([])
  const [slots, setSlots] = useState<string[]>(DEFAULT_SLOTS)
  const [where, setWhere] = useState('downtown')
  const candidate = mode === 'candidate'
  const save = () =>
    act('onboard', () => api.saveProfile({ name, look, area: where, radiusMi: 2.5, slots, roles, skills: [] }), candidate ? 'Welcome to town! 🎉' : undefined)

  return (
    <div className="no-scrollbar h-full overflow-y-auto">
      <div className="pt-safe mx-auto flex min-h-full max-w-md flex-col px-4 pb-6">
        <div className="py-3">
          <Logo small />
        </div>
        {step === 'look' ? (
          <div className="anim-fade flex flex-1 flex-col">
            <AvatarEditor look={look} onChange={setLook} name={name} onName={setName} />
            <div className="flex-1" />
            <Btn size="lg" tone="pink" className="mt-5 w-full" loading={busy === 'onboard'} onClick={() => (candidate ? setStep('prefs') : save())}>
              {candidate ? '→' : <Icon.check />}
            </Btn>
          </div>
        ) : (
          <div className="anim-fade flex flex-1 flex-col gap-5">
            <Section icon="🧑‍🍳" title="Roles">
              <RolePicker value={roles} onChange={setRoles} />
            </Section>
            <Section icon="🗓️" title="When">
              <div className="rounded-3xl bg-white p-3 shadow-soft">
                <SlotGrid value={slots} onChange={setSlots} />
              </div>
            </Section>
            <Section icon="📍" title="Where">
              <AreaPicker value={where} onChange={setWhere} />
            </Section>
            <div className="flex-1" />
            <div className="flex gap-3">
              <Btn size="lg" tone="white" onClick={() => setStep('look')} label="Back">
                <Icon.back />
              </Btn>
              <Btn size="lg" tone="pink" className="flex-1" loading={busy === 'onboard'} onClick={save}>
                Let’s go 🎉
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
