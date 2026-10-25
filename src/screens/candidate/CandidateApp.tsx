import { useState } from 'react'
import { useStore } from '../../store'
import { Notifications } from '../../components/Overlays'
import { Icon, TabBar } from '../../components/ui'
import { Me } from './Me'
import { Plans } from './Plans'
import { Town } from './Town'

type Tab = 'town' | 'plans' | 'me'

export function CandidateApp() {
  const { snap } = useStore()
  const [tab, setTab] = useState<Tab>('town')
  const [bell, setBell] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)
  const invites = snap.bookings.filter((b) => b.candidateId === snap.me?.id && b.status === 'invited').length

  return (
    <div className="flex h-full flex-col">
      <main className="relative min-h-0 flex-1">
        {tab === 'town' && <Town onMe={() => setTab('me')} onBell={() => setBell(true)} selected={selected} onSelect={setSelected} />}
        {tab === 'plans' && (
          <Plans
            onBell={() => setBell(true)}
            onPlace={(id) => {
              setSelected(id)
              setTab('town')
            }}
          />
        )}
        {tab === 'me' && <Me />}
      </main>
      <TabBar
        value={tab}
        onChange={setTab}
        tabs={[
          { id: 'town', icon: <Icon.map />, label: 'Town' },
          { id: 'plans', icon: <Icon.cal />, label: 'Calendar', dot: invites },
          { id: 'me', icon: <Icon.me />, label: 'Me' },
        ]}
      />
      <Notifications open={bell} onClose={() => setBell(false)} />
    </div>
  )
}
