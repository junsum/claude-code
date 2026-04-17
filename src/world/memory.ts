import type { RumorMemoryItem } from './types.js'

const MAX_RUMORS = 20

const normalizeRumorText = (text: string): string => text.trim().replace(/\s+/g, ' ')

export const governRumors = (items: RumorMemoryItem[]): RumorMemoryItem[] => {
  const seen = new Set<string>()
  const out: RumorMemoryItem[] = []
  for (let i = items.length - 1; i >= 0; i--) {
    const key = normalizeRumorText(items[i].text)
    if (seen.has(key)) continue
    seen.add(key)
    out.push(items[i])
  }
  return out.reverse().slice(-MAX_RUMORS)
}
