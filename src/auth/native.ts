// "No login": the app uses the account the phone already has —
// Sign in with Apple on iOS (the App Store Apple ID) and the Google account
// on Android (the Google Play account). No usernames or passwords.
import { Capacitor } from '@capacitor/core'

export const platform = Capacitor.getPlatform() as 'ios' | 'android' | 'web'
export const isNative = Capacitor.isNativePlatform()

export interface NativeToken {
  provider: 'apple' | 'google'
  idToken: string
  /** raw nonce — Supabase compares its hash with the one inside the token */
  nonce: string
}

async function sha256(text: string) {
  const buf = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text))
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, '0')).join('')
}

let ready = false

/** One system sheet on first launch; Android can auto-select the Play account. */
export async function nativeSignIn(silent = false): Promise<NativeToken | null> {
  if (!isNative) return null
  const { SocialLogin } = await import('@capgo/capacitor-social-login')
  if (!ready) {
    await SocialLogin.initialize(
      platform === 'ios'
        ? { apple: {}, google: { iOSClientId: import.meta.env.VITE_GOOGLE_IOS_CLIENT_ID } }
        : { google: { webClientId: import.meta.env.VITE_GOOGLE_WEB_CLIENT_ID } },
    )
    ready = true
  }
  const nonce = crypto.randomUUID()
  const hashed = await sha256(nonce)

  if (platform === 'ios') {
    if (silent) return null // Apple always needs one tap the first time
    const res = await SocialLogin.login({ provider: 'apple', options: { scopes: ['name'], nonce: hashed } })
    if (!res.result.idToken) throw new Error('No Apple ID token')
    return { provider: 'apple', idToken: res.result.idToken, nonce }
  }

  const res = await SocialLogin.login({
    provider: 'google',
    options: { style: 'bottom', filterByAuthorizedAccounts: silent, autoSelectEnabled: true, nonce: hashed },
  })
  const idToken = (res.result as { idToken?: string | null }).idToken
  if (!idToken) throw new Error('No Google ID token')
  return { provider: 'google', idToken, nonce }
}
