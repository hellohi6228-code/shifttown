import { useState } from 'react'
import { Notifications } from '../../components/Overlays'
import { Icon, TabBar } from '../../components/ui'
import { Me } from './Me'
import { Plans } from './Plans'
import { Town } from './Town'

type Tab = 'town' | 'plans' | 'me'

export function CandidateApp() {
  const [tab, setTab] = useState<Tab>('town')
  const [bell, setBell] = useState(false)
  const [selected, setSelected] = useState<string | null>(null)

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
          { id: 'plans', icon: <Icon.cal />, label: 'Calendar' },
          { id: 'me', icon: <Icon.me />, label: 'Me' },
        ]}
      />
      <Notifications open={bell} onClose={() => setBell(false)} />
    </div>
  )
}
