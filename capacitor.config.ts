import type { CapacitorConfig } from '@capacitor/cli'

const config: CapacitorConfig = {
  appId: 'town.shift.ithaca',
  appName: 'ShiftTown',
  webDir: 'dist',
  backgroundColor: '#FFFDF7',
  ios: { contentInset: 'never' },
  plugins: {
    SocialLogin: { google: true, apple: true, facebook: false, twitter: false },
  },
}

export default config
