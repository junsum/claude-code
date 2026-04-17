import type { Choice, EffectDelta, WorldState } from './types.js'

export type DirectorInput = {
  actorId: string
  rawText: string
  canonicalText: string
  state: WorldState
}

export type DirectorResult = {
  message: string
  choices: Choice[]
  statePatch?: Partial<WorldState>
  logSummary?: string
}

const isPlainObject = (v: unknown): v is Record<string, unknown> => {
  if (!v || typeof v !== 'object') return false
  const proto = Object.getPrototypeOf(v)
  return proto === Object.prototype || proto === null
}

const clampString = (v: unknown, maxLen: number): string =>
  typeof v === 'string' ? v.slice(0, maxLen) : ''

const clampInt = (v: unknown, fallback: number): number => {
  if (typeof v !== 'number' || !Number.isFinite(v)) return fallback
  return Math.trunc(v)
}

const allowedDynamicMoveIds = new Set(['order_drink', 'ask_rumors', 'keep_walking', 'follow_rumor'])
const allowedGeneratedSceneKinds = new Set([
  'threshold_pause',
  'street_roam',
  'inn_rest',
  'rumor_listening',
  'rumor_trail',
])
const allowedLocationTypes = new Set(['street', 'inn', 'market'])
const allowedTensions = new Set(['low', 'medium', 'high'])
const allowedNpcRoles = new Set(['innkeeper', 'traveler', 'guard', 'merchant'])
const allowedRumorSourceTypes = new Set(['ask_rumors', 'legacy'])

const sanitizeChoices = (v: unknown): Choice[] => {
  if (!Array.isArray(v)) return []
  const out: Choice[] = []
  for (const item of v) {
    if (!item || typeof item !== 'object') continue
    const id = (item as any).id
    const label = (item as any).label
    if (typeof id !== 'string' || typeof label !== 'string') continue
    out.push({ id: id.slice(0, 64), label: label.slice(0, 64) })
    if (out.length >= 12) break
  }
  return out
}

const sanitizeObjectives = (v: unknown): WorldState['objectives'] | undefined => {
  if (!Array.isArray(v)) return undefined
  const out: WorldState['objectives'] = []
  for (const item of v) {
    if (!isPlainObject(item)) continue
    const id = item.id
    const status = item.status
    const step = item.step
    if (id === 'enter_city') {
      if (status !== 'active' && status !== 'completed') continue
      if (step !== 'at_gate' && step !== 'inside_gatehouse' && step !== 'in_city') continue
      out.push({ id: 'enter_city', status, step } as any)
    } else if (id === 'find_inn') {
      if (status !== 'active' && status !== 'completed') continue
      if (step !== 'seeking' && step !== 'found') continue
      out.push({ id: 'find_inn', status, step } as any)
    }
    if (out.length >= 8) break
  }
  return out
}

const sanitizeMemory = (v: unknown): WorldState['memory'] | undefined => {
  if (!isPlainObject(v)) return undefined
  const innVisited = (v as any).innVisited
  const heardRumors = (v as any).heardRumors
  if (typeof innVisited !== 'boolean') return undefined
  if (!Array.isArray(heardRumors)) return undefined
  const outRumors: Array<{ id: string; text: string; sourceType: 'ask_rumors' | 'legacy' }> = []
  for (const r of heardRumors) {
    if (!isPlainObject(r)) continue
    const id = (r as any).id
    const text = (r as any).text
    const sourceType = (r as any).sourceType
    if (typeof id !== 'string' || typeof text !== 'string' || typeof sourceType !== 'string') continue
    if (!allowedRumorSourceTypes.has(sourceType)) continue
    outRumors.push({
      id: id.slice(0, 96),
      text: text.slice(0, 240),
      sourceType,
    })
    if (outRumors.length >= 40) break
  }
  return { innVisited, heardRumors: outRumors as any }
}

const sanitizeSceneSeed = (v: unknown): WorldState['sceneSeed'] | null | undefined => {
  if (v === null) return null
  if (!isPlainObject(v)) return undefined
  const seedId = (v as any).seedId
  const fromEventId = (v as any).fromEventId
  const turn = (v as any).turn
  const lastMoveId = (v as any).lastMoveId
  if (typeof seedId !== 'string' || typeof fromEventId !== 'string') return undefined
  const out: any = {
    seedId: seedId.slice(0, 120),
    fromEventId: fromEventId.slice(0, 64),
    turn: clampInt(turn, 0),
  }
  if (typeof lastMoveId === 'string' && allowedDynamicMoveIds.has(lastMoveId)) out.lastMoveId = lastMoveId
  return out
}

const sanitizeSceneSkeleton = (v: unknown): WorldState['sceneSkeleton'] | null | undefined => {
  if (v === null) return null
  if (!isPlainObject(v)) return undefined
  const sceneId = (v as any).sceneId
  const sourceSeedId = (v as any).sourceSeedId
  const locationType = (v as any).locationType
  const tension = (v as any).tension
  const npcRoles = (v as any).npcRoles
  const availableMoves = (v as any).availableMoves
  const shortDescription = (v as any).shortDescription
  const lastMoveId = (v as any).lastMoveId
  const generatedSceneKind = (v as any).generatedSceneKind
  if (typeof sceneId !== 'string' || typeof sourceSeedId !== 'string') return undefined
  if (typeof locationType !== 'string' || !allowedLocationTypes.has(locationType)) return undefined
  if (typeof tension !== 'string' || !allowedTensions.has(tension)) return undefined
  if (!Array.isArray(npcRoles) || !Array.isArray(availableMoves) || typeof shortDescription !== 'string') {
    return undefined
  }
  const outNpcRoles: Array<'innkeeper' | 'traveler' | 'guard' | 'merchant'> = []
  for (const r of npcRoles) {
    if (typeof r !== 'string' || !allowedNpcRoles.has(r)) continue
    outNpcRoles.push(r as any)
    if (outNpcRoles.length >= 6) break
  }
  const outMoves: Array<'order_drink' | 'ask_rumors' | 'keep_walking' | 'follow_rumor'> = []
  for (const m of availableMoves) {
    if (typeof m !== 'string' || !allowedDynamicMoveIds.has(m)) continue
    outMoves.push(m as any)
    if (outMoves.length >= 8) break
  }
  const out: any = {
    sceneId: sceneId.slice(0, 160),
    sourceSeedId: sourceSeedId.slice(0, 120),
    locationType,
    tension,
    npcRoles: outNpcRoles,
    availableMoves: outMoves,
    shortDescription: shortDescription.slice(0, 320),
  }
  if (typeof lastMoveId === 'string' && allowedDynamicMoveIds.has(lastMoveId)) out.lastMoveId = lastMoveId
  if (typeof generatedSceneKind === 'string' && allowedGeneratedSceneKinds.has(generatedSceneKind)) {
    out.generatedSceneKind = generatedSceneKind
  }
  return out
}

export const validateDirectorResult = (
  stateBefore: WorldState,
  result: DirectorResult,
): { delta: EffectDelta; message: string; choices: Choice[]; logSummary: string } => {
  const message = clampString(result.message, 1200)
  const choices = sanitizeChoices(result.choices)

  const patch: Partial<WorldState> = {}
  if (isPlainObject(result.statePatch)) {
    const objectives = sanitizeObjectives((result.statePatch as any).objectives)
    const memory = sanitizeMemory((result.statePatch as any).memory)
    const sceneSeed = sanitizeSceneSeed((result.statePatch as any).sceneSeed)
    const sceneSkeleton = sanitizeSceneSkeleton((result.statePatch as any).sceneSkeleton)
    const sceneEntered = (result.statePatch as any).sceneEntered

    if (objectives) patch.objectives = objectives
    if (memory) patch.memory = memory
    if (sceneSeed !== undefined) patch.sceneSeed = sceneSeed
    if (sceneSkeleton !== undefined) patch.sceneSkeleton = sceneSkeleton
    if (typeof sceneEntered === 'boolean') patch.sceneEntered = sceneEntered
  }

  if (patch.sceneSeed === undefined) patch.sceneSeed = stateBefore.sceneSeed
  if (patch.sceneSkeleton === undefined) patch.sceneSkeleton = stateBefore.sceneSkeleton

  const delta: EffectDelta = {
    turnInc: 1,
    statePatch: patch,
    pendingChoices: choices,
  }

  const logSummary =
    typeof result.logSummary === 'string' && result.logSummary.trim() !== ''
      ? result.logSummary.slice(0, 160)
      : 'director turn'

  return { delta, message, choices, logSummary }
}
