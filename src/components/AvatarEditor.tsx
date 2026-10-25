import type { Look } from '../types'
import { ACCS, HAIR_COLORS, HAIRS, OUTFIT_COLORS, OUTFITS, randomLook, SKIN } from '../lib/look'
import { Avatar } from './Avatar'
import { Icon } from './ui'

function Row({ children }: { children: React.ReactNode }) {
  return <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4 py-1">{children}</div>
}

function Swatch({ color, on, onClick }: { color: string; on: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`h-10 w-10 shrink-0 rounded-full border-[3px] transition active:scale-90 ${on ? 'border-ink scale-110' : 'border-white shadow-soft'}`}
      style={{ background: color }}
    />
  )
}

function Option({ on, onClick, children }: { on: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={onClick}
      aria-pressed={on}
      className={`flex h-16 w-14 shrink-0 items-center justify-center overflow-hidden rounded-2xl border-[3px] bg-white transition active:scale-95 ${on ? 'border-pink' : 'border-transparent shadow-soft'}`}
    >
      {children}
    </button>
  )
}

export function AvatarEditor({ look, onChange, name, onName }: { look: Look; onChange: (l: Look) => void; name: string; onName: (n: string) => void }) {
  const set = (k: keyof Look, v: number) => onChange({ ...look, [k]: v })
  return (
    <div className="flex flex-col gap-3">
      <div className="relative mx-auto flex flex-col items-center">
        <div className="absolute top-10 h-36 w-36 rounded-full bg-pink-soft" />
        <Avatar look={look} size={150} anim="wave" className="relative" key={JSON.stringify(look)} />
        <button
          onClick={() => onChange(randomLook())}
          aria-label="Random"
          className="absolute top-2 -right-12 flex h-11 w-11 items-center justify-center rounded-full bg-sun text-ink shadow-pop active:translate-y-[3px] active:shadow-none"
        >
          <Icon.dice />
        </button>
      </div>
      <input
        value={name}
        onChange={(e) => onName(e.target.value.slice(0, 24))}
        placeholder="Name"
        aria-label="Name"
        className="mx-auto h-12 w-56 rounded-2xl border-2 border-line bg-white text-center text-xl font-bold outline-none focus:border-pink"
      />
      <Row>
        {SKIN.map((c, i) => (
          <Swatch key={c} color={c} on={look.skin === i} onClick={() => set('skin', i)} />
        ))}
      </Row>
      <Row>
        {HAIRS.map((h, i) => (
          <Option key={h} on={look.hair === i} onClick={() => set('hair', i)}>
            <Avatar look={{ ...look, hair: i, acc: 0 }} size={52} head anim="none" />
          </Option>
        ))}
      </Row>
      <Row>
        {HAIR_COLORS.map((c, i) => (
          <Swatch key={c} color={c} on={look.hairColor === i} onClick={() => set('hairColor', i)} />
        ))}
      </Row>
      <Row>
        {OUTFITS.map((o, i) => (
          <Option key={o} on={look.outfit === i} onClick={() => set('outfit', i)}>
            <Avatar look={{ ...look, outfit: i }} size={50} body anim="none" />
          </Option>
        ))}
      </Row>
      <Row>
        {OUTFIT_COLORS.map((c, i) => (
          <Swatch key={c} color={c} on={look.outfitColor === i} onClick={() => set('outfitColor', i)} />
        ))}
      </Row>
      <Row>
        {ACCS.map((a, i) => (
          <Option key={a} on={look.acc === i} onClick={() => set('acc', i)}>
            {i === 0 ? <span className="text-2xl text-muted">∅</span> : <Avatar look={{ ...look, acc: i }} size={52} head anim="none" />}
          </Option>
        ))}
      </Row>
    </div>
  )
}
