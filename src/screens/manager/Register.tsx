import { useMemo, useRef, useState } from 'react'
import { useStore } from '../../store'
import { area, fromGrid, inBounds, parseMapsUrl, toGrid, unIso } from '../../lib/geo'
import { DEMO_CODES } from '../../data/demo'
import { OX, OY, px } from '../../components/map/geometry'
import { DECOS, Scene } from '../../components/map/Scene'
import { Btn, Icon } from '../../components/ui'
import { Logo } from '../Welcome'

const CUISINES: [string, string][] = [
  ['🍔', 'Burgers'], ['🍕', 'Pizza'], ['🍜', 'Noodles'], ['🌮', 'Tacos'], ['🍣', 'Sushi'],
  ['☕', 'Café'], ['🥗', 'Salads'], ['🥯', 'Bakery'], ['🍛', 'Curry'], ['🍽️', 'Restaurant'],
]

const guessEmoji = (name: string) => {
  const n = name.toLowerCase()
  const hit = ([
    [/pizz/, '🍕'], [/taco|taqu|mexic|burrito/, '🌮'], [/sushi|japan/, '🍣'], [/noodle|ramen|pho|udon/, '🍜'],
    [/burger|grill|diner/, '🍔'], [/caf|coffee|espresso|tea/, '☕'], [/bagel|bake|bread|donut/, '🥯'],
    [/curry|india|thai/, '🍛'], [/salad|green|farm/, '🥗'],
  ] as [RegExp, string][]).find(([re]) => re.test(n))
  return hit ? hit[1] : '🍽️'
}

/** Tap to drop the pin. Shows the same illustrated town. */
function PinMap({ lat, lng, onPick }: { lat: number; lng: number; onPick: (lat: number, lng: number) => void }) {
  const svg = useRef<SVGSVGElement>(null)
  const g = toGrid(lat, lng)
  const p = px(g.gx, g.gy)
  const [center] = useState(p)
  const W = 420
  const H = 260
  return (
    <svg
      ref={svg}
      viewBox={`${center.x - W / 2} ${center.y - H / 2} ${W} ${H}`}
      className="h-52 w-full touch-none rounded-3xl bg-cream shadow-soft"
      onClick={(e) => {
        const el = svg.current
        const m = el?.getScreenCTM()
        if (!el || !m) return
        const pt = new DOMPoint(e.clientX, e.clientY).matrixTransform(m.inverse())
        const gg = unIso(pt.x - OX, pt.y - OY)
        const ll = fromGrid(gg.gx, gg.gy)
        if (inBounds(ll.lat, ll.lng)) onPick(ll.lat, ll.lng)
      }}
    >
      <Scene decos={DECOS} />
      <g transform={`translate(${p.x} ${p.y})`}>
        <g className="anim-pop" style={{ transformBox: 'fill-box', transformOrigin: 'bottom' }}>
        <ellipse cx="0" cy="2" rx="14" ry="6" fill="rgba(58,53,80,0.2)" />
        <path d="M0 0 C-14 -18 -18 -26 -18 -34 A18 18 0 1 1 18 -34 C18 -26 14 -18 0 0Z" fill="#FF6B8B" stroke="#fff" strokeWidth="3" />
        <circle cx="0" cy="-34" r="7" fill="#fff" />
        </g>
      </g>
    </svg>
  )
}

export function Register() {
  const { api, act, busy, say, setMode, celebrate } = useStore()
  const [link, setLink] = useState('')
  const [code, setCode] = useState('')
  const [step, setStep] = useState<'link' | 'confirm'>('link')
  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [emoji, setEmoji] = useState('🍽️')
  const [pin, setPin] = useState<{ lat: number; lng: number }>(() => ({ lat: area('downtown').lat, lng: area('downtown').lng }))
  const [checking, setChecking] = useState(false)
  const parsed = useMemo(() => parseMapsUrl(link), [link])

  const next = async () => {
    if (!code.trim()) return say('Add your invite code', 'err')
    setChecking(true)
    try {
      const kind = await api.checkCode(code)
      if (kind === 'invalid') return say('Code not valid', 'err')
      if (kind === 'join') {
        await act('register', () => api.register({ code, mapsUrl: link, name: '', address: '', lat: 0, lng: 0, cuisine: '', emoji: '' }))
        return
      }
      if (!parsed.ok) return say('Paste a Google Maps link', 'err')
      setName(parsed.name ?? '')
      setEmoji(guessEmoji(parsed.name ?? ''))
      setAddress(parsed.address ?? 'Ithaca, NY')
      if (parsed.lat && parsed.lng && inBounds(parsed.lat, parsed.lng)) setPin({ lat: parsed.lat, lng: parsed.lng })
      else if (parsed.lat && parsed.lng) say('Pin is outside the map — tap to place', 'err')
      setStep('confirm')
    } catch (e) {
      say((e as Error).message, 'err')
    } finally {
      setChecking(false)
    }
  }

  const open = () =>
    act('register', () => api.register({ code, mapsUrl: link, name, address, lat: pin.lat, lng: pin.lng, cuisine: CUISINES.find(([e]) => e === emoji)?.[1] ?? 'Restaurant', emoji })).then(
      (id) => id && celebrate({ title: 'You’re on the map!', sub: `${emoji} ${name}` }),
    )

  const paste = async () => {
    try {
      setLink(await navigator.clipboard.readText())
    } catch {
      say('Paste with long-press', 'err')
    }
  }

  return (
    <div className="no-scrollbar h-full overflow-y-auto">
      <div className="pt-safe mx-auto flex min-h-full max-w-md flex-col gap-4 px-4 pb-6">
        <div className="flex items-center justify-between py-2">
          <Logo small />
          <Btn size="sm" tone="white" onClick={() => setMode('candidate')}>
            🍳 <Icon.swap size={18} />
          </Btn>
        </div>
        {step === 'link' ? (
          <div className="anim-fade flex flex-1 flex-col gap-4">
            <div className="anim-float py-4 text-center text-7xl">🏗️</div>
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-lg font-extrabold">📍 Google Maps link</span>
              <div className="flex gap-2">
                <input value={link} onChange={(e) => setLink(e.target.value)} placeholder="https://maps.app.goo.gl/…" inputMode="url" className="h-13 min-w-0 flex-1 rounded-2xl border-2 border-line bg-white px-4 font-semibold outline-none focus:border-sky" />
                <Btn tone="white" size="lg" onClick={paste} label="Paste">
                  <Icon.clip />
                </Btn>
              </div>
              {link && <span className={`px-1 text-[14px] font-bold ${parsed.ok ? 'text-mint-deep' : 'text-red'}`}>{parsed.ok ? `✓ ${parsed.name ?? 'Google Maps'}` : '✕ Not a Google Maps link'}</span>}
            </label>
            <label className="flex flex-col gap-1.5">
              <span className="px-1 text-lg font-extrabold">🔑 Invite code</span>
              <input value={code} onChange={(e) => setCode(e.target.value.toUpperCase())} placeholder="ITH-XXXX-XXXXXX" autoCapitalize="characters" className="h-13 rounded-2xl border-2 border-line bg-white px-4 font-bold tracking-wider outline-none focus:border-sky" />
            </label>
            {api.mode === 'demo' && (
              <div className="flex flex-wrap items-center gap-2 rounded-2xl border-2 border-dashed border-lav bg-lav-soft/60 p-2.5 text-[14px] font-bold text-lav-deep">
                DEMO
                <button className="rounded-full bg-white px-3 py-1" onClick={() => (setCode(DEMO_CODES.newPlace), setLink('https://www.google.com/maps/place/Cascadilla+Curry+House,+412+Eddy+St,+Ithaca,+NY+14850/@42.4415,-76.4868,17z/data=!3m1!4b1!4m6!3m5!1s0x0:0x0!8m2!3d42.4413!4d-76.4866'))}>
                  🆕 New place
                </button>
                <button className="rounded-full bg-white px-3 py-1" onClick={() => setCode(DEMO_CODES.joinGorge)}>
                  🍔 Join Gorge Grill
                </button>
              </div>
            )}
            <div className="flex-1" />
            <Btn size="lg" tone="sky" className="w-full" loading={checking || busy === 'register'} onClick={next}>
              →
            </Btn>
          </div>
        ) : (
          <div className="anim-fade flex flex-1 flex-col gap-3">
            <PinMap lat={pin.lat} lng={pin.lng} onPick={(lat, lng) => setPin({ lat, lng })} />
            <input value={name} onChange={(e) => setName(e.target.value)} placeholder="Restaurant name" className="h-13 rounded-2xl border-2 border-line bg-white px-4 text-xl font-extrabold outline-none focus:border-sky" />
            <input value={address} onChange={(e) => setAddress(e.target.value)} placeholder="Address" className="h-12 rounded-2xl border-2 border-line bg-white px-4 font-semibold outline-none focus:border-sky" />
            <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">
              {CUISINES.map(([e]) => (
                <button key={e} ref={emoji === e ? (el) => el?.scrollIntoView({ inline: 'center', block: 'nearest' }) : undefined} onClick={() => setEmoji(e)} className={`flex h-13 w-13 shrink-0 items-center justify-center rounded-2xl text-3xl transition active:scale-90 ${emoji === e ? 'bg-sky-soft ring-4 ring-sky' : 'bg-white shadow-soft'}`}>
                  {e}
                </button>
              ))}
            </div>
            <div className="flex-1" />
            <div className="flex gap-3">
              <Btn size="lg" tone="white" onClick={() => setStep('link')} label="Back">
                <Icon.back />
              </Btn>
              <Btn size="lg" tone="sky" className="flex-1" disabled={name.trim().length < 2} loading={busy === 'register'} onClick={open}>
                Open 🎉
              </Btn>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
