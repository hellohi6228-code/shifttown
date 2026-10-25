import { useStore } from './store'
import { Celebrate, Toast } from './components/Overlays'
import { CandidateApp } from './screens/candidate/CandidateApp'
import { ManagerApp } from './screens/manager/ManagerApp'
import { Register } from './screens/manager/Register'
import { Logo, Onboard, Welcome } from './screens/Welcome'

function Screen() {
  const { ready, identity, snap, mode } = useStore()
  if (!ready)
    return (
      <div className="flex h-full items-center justify-center">
        <div className="anim-float">
          <Logo />
        </div>
      </div>
    )
  if (!identity) return <Welcome />
  if (!snap.me) return <Onboard />
  if (mode === 'manager') return snap.myRestaurantIds.length ? <ManagerApp /> : <Register />
  return <CandidateApp />
}

export default function App() {
  return (
    <div className="mx-auto h-full max-w-xl overflow-hidden bg-cream sm:border-x sm:border-line">
      <Screen />
      <Toast />
      <Celebrate />
    </div>
  )
}
