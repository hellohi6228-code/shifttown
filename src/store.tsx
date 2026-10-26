import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState, type ReactNode } from 'react'
import type { Restaurant, Snapshot } from './types'
import { UserError, type Api, type Identity } from './data/api'
import { LocalApi } from './data/localApi'
import { SupabaseApi } from './data/supabaseApi'
import { badges, BADGES, level } from './lib/rules'

const url = import.meta.env.VITE_SUPABASE_URL as string | undefined
const key = import.meta.env.VITE_SUPABASE_ANON_KEY as string | undefined
const api: Api = url && key ? new SupabaseApi(url, key) : new LocalApi()

const EMPTY: Snapshot = { me: null, myRestaurantIds: [], restaurants: [], opps: [], bookings: [], quests: [], reviews: [], people: [], stats: {}, notes: [] }

export type Mode = 'candidate' | 'manager'
export interface Celebration {
  title: string
  sub?: string
  badge?: { icon: string; name: string }
  building?: Restaurant
}

interface Store {
  api: Api
  ready: boolean
  identity: Identity | null
  snap: Snapshot
  mode: Mode
  setMode(m: Mode): void
  motion: boolean
  setMotion(on: boolean): void
  busy: string | null
  toast: { text: string; tone: 'ok' | 'err'; id: number } | null
  say(text: string, tone?: 'ok' | 'err'): void
  celebration: Celebration | null
  celebrate(c: Celebration | null): void
  refresh(): Promise<void>
  act<T>(key: string, fn: () => Promise<T>, ok?: string | ((r: T) => string | null)): Promise<T | undefined>
  signIn(mode: Mode): Promise<void>
  resetSession(): void
}

const Ctx = createContext<Store | null>(null)

const pref = {
  get: (k: string) => {
    try {
      return localStorage.getItem(k)
    } catch {
      return null
    }
  },
  set: (k: string, v: string) => {
    try {
      localStorage.setItem(k, v)
    } catch {
      /* ignore */
    }
  },
}

const seenKey = 'st.seen'

export function StoreProvider({ children }: { children: ReactNode }) {
  const [ready, setReady] = useState(false)
  const [identity, setIdentity] = useState<Identity | null>(null)
  const [snap, setSnap] = useState<Snapshot>(EMPTY)
  const [mode, setModeState] = useState<Mode>((pref.get('st.mode') as Mode) || 'candidate')
  const [motion, setMotionState] = useState(() => {
    const saved = pref.get('st.motion')
    if (saved) return saved === 'on'
    return !window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
  })
  const [busy, setBusy] = useState<string | null>(null)
  const [toast, setToast] = useState<Store['toast']>(null)
  const [celebration, celebrate] = useState<Celebration | null>(null)
  const prevBadges = useRef<Set<string> | null>(null)
  const levels = useRef<Record<string, number> | null>(null)
  const modeRef = useRef(mode)
  modeRef.current = mode

  useEffect(() => {
    document.documentElement.dataset.motion = motion ? 'on' : 'off'
  }, [motion])

  const say = useCallback((text: string, tone: 'ok' | 'err' = 'ok') => setToast({ text, tone, id: Date.now() }), [])

  const refresh = useCallback(async () => {
    const s = await api.load()
    setSnap(s)
    if (!s.me) return
    // Restaurants level up as they finish trainings/shifts and review people.
    const places = s.restaurants.filter((r) => s.myRestaurantIds.includes(r.id))
    const lv = Object.fromEntries(places.map((r) => [r.id, level(r.xp).lv]))
    const up = levels.current && places.find((r) => levels.current![r.id] !== undefined && lv[r.id] > levels.current![r.id])
    levels.current = lv
    if (up && modeRef.current === 'manager') return celebrate({ title: `Level ${lv[up.id]}!`, sub: up.name, building: up })
    if (modeRef.current !== 'candidate') return
    // Celebrate quests and unlocks the candidate hasn't seen yet.
    let seen: string[] = []
    try {
      seen = JSON.parse(pref.get(seenKey) || '[]')
    } catch {
      seen = []
    }
    const fresh = s.notes.filter((n) => !n.read && (n.kind === 'quest' || n.kind === 'unlocked') && !seen.includes(n.id))
    const mine = badges(s, s.me.id)
    const newBadge = prevBadges.current ? BADGES.find((b) => mine.has(b.id) && !prevBadges.current!.has(b.id)) : undefined
    prevBadges.current = mine
    if (fresh.length) {
      const q = fresh.find((n) => n.kind === 'unlocked') ?? fresh[0]
      const place = s.restaurants.find((r) => r.id === q.restaurantId)
      celebrate({
        title: q.kind === 'unlocked' ? 'Store unlocked!' : 'Quest complete!',
        sub: q.text,
        building: q.kind === 'unlocked' ? place : undefined,
        badge: newBadge ? { icon: newBadge.icon, name: newBadge.name } : undefined,
      })
      pref.set(seenKey, JSON.stringify([...seen, ...fresh.map((n) => n.id)].slice(-200)))
    } else if (newBadge) celebrate({ title: 'New badge!', badge: { icon: newBadge.icon, name: newBadge.name } })
  }, [])

  useEffect(() => {
    ;(async () => {
      try {
        const id = await api.restore()
        setIdentity(id)
        if (id) await refresh()
      } catch (e) {
        console.error(e)
      } finally {
        setReady(true)
      }
    })()
  }, [refresh])

  // Stay fresh without a refresh button.
  useEffect(() => {
    if (!identity) return
    const tick = () => document.visibilityState === 'visible' && refresh().catch(() => {})
    const t = setInterval(tick, 20_000)
    document.addEventListener('visibilitychange', tick)
    window.addEventListener('focus', tick)
    return () => {
      clearInterval(t)
      document.removeEventListener('visibilitychange', tick)
      window.removeEventListener('focus', tick)
    }
  }, [identity, refresh])

  const act = useCallback(
    async <T,>(key: string, fn: () => Promise<T>, ok?: string | ((r: T) => string | null)) => {
      setBusy(key)
      try {
        const r = await fn()
        await refresh()
        const msg = typeof ok === 'function' ? ok(r) : ok
        if (msg) say(msg)
        return r
      } catch (e) {
        say(e instanceof UserError || (e instanceof Error && e.message.length < 60) ? (e as Error).message : 'Something went wrong', 'err')
        refresh().catch(() => {})
        return undefined
      } finally {
        setBusy(null)
      }
    },
    [refresh, say],
  )

  const setMode = useCallback(
    (m: Mode) => {
      pref.set('st.mode', m)
      modeRef.current = m
      setModeState(m)
      if (m === 'candidate') refresh().catch(() => {})
    },
    [refresh],
  )

  const setMotion = useCallback((on: boolean) => {
    pref.set('st.motion', on ? 'on' : 'off')
    setMotionState(on)
  }, [])

  const signIn = useCallback(
    async (m: Mode) => {
      setMode(m)
      setBusy('signin')
      try {
        const id = await api.signIn()
        setIdentity(id)
        await refresh()
      } catch (e) {
        const code = (e as { code?: string }).code
        if (code !== 'USER_CANCELLED') say('Sign-in didn’t finish', 'err')
      } finally {
        setBusy(null)
      }
    },
    [refresh, say, setMode],
  )

  const resetSession = useCallback(() => {
    prevBadges.current = null
    levels.current = null
    setIdentity(null)
    setSnap(EMPTY)
    api.restore().then(async (id) => {
      setIdentity(id)
      if (id) await refresh()
    })
  }, [refresh])

  const value = useMemo<Store>(
    () => ({ api, ready, identity, snap, mode, setMode, motion, setMotion, busy, toast, say, celebration, celebrate, refresh, act, signIn, resetSession }),
    [ready, identity, snap, mode, setMode, motion, setMotion, busy, toast, say, celebration, refresh, act, signIn, resetSession],
  )
  return <Ctx.Provider value={value}>{children}</Ctx.Provider>
}

export function useStore() {
  const s = useContext(Ctx)
  if (!s) throw new Error('StoreProvider missing')
  return s
}
