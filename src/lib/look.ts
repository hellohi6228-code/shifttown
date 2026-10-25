import type { Look } from '../types'

export const SKIN = ['#FFE3CF', '#F8CBA6', '#E7AE84', '#C88B5E', '#9B653D', '#6A4128']
export const HAIR_COLORS = ['#2E2A3A', '#6B4226', '#C9853F', '#F2C94C', '#F08AAE', '#7AA8FF', '#C9C6D6']
export const HAIRS = ['Short', 'Bob', 'Long', 'Bun', 'Curly', 'Spiky', 'Buzz']
export const OUTFITS = ['Tee', 'Apron', 'Hoodie', 'Chef']
export const OUTFIT_COLORS = ['#FF8FB1', '#6EC6FF', '#FFD25A', '#5CC49E', '#B79CFF', '#FFB38A', '#FFFFFF', '#4A4560']
export const ACCS = ['None', 'Glasses', 'Cap', 'Bandana', 'Bow', 'Headphones', 'Chef hat']

const pick = (n: number) => Math.floor(Math.random() * n)

export const randomLook = (): Look => ({
  skin: pick(SKIN.length),
  hair: pick(HAIRS.length),
  hairColor: pick(HAIR_COLORS.length),
  outfit: pick(OUTFITS.length),
  outfitColor: pick(OUTFIT_COLORS.length - 1),
  acc: pick(ACCS.length),
})

const NAMES = ['Sunny', 'Pip', 'Juno', 'Kiwi', 'Mochi', 'Rio', 'Bean', 'Taro', 'Nova', 'Ziggy']
export const randomName = () => NAMES[pick(NAMES.length)]
