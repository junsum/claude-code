import type { LocalCommandResult } from '../types/command.js'
import type { Choice, EventRecord, TurnInput, TurnResult, WorldState } from './types.js'
import { createStubDirector } from './director.js'
import { validateDirectorResult } from './directorSchema.js'
import { parseEvent, defaultChoicesForState } from './events.js'
import { applyDelta } from './reducers.js'
import { appendEvent, loadState, saveState } from './persistence.js'

const director = createStubDirector()

const makeRecord = (actorId: string, eventId: string, summary: string): EventRecord => ({
  time: new Date().toISOString(),
  actorId,
  eventId,
  summary,
})

const defaultState = (): WorldState => ({
  turn: 0,
  players: { player: { id: 'player', name: 'You' } },
  worldNotes: [],
  log: [],
  meta: { createdAt: new Date().toISOString(), updatedAt: new Date().toISOString() },
  scene: 'gate_scene',
  sceneEntered: false,
  guardDisposition: 'neutral',
  admitted: false,
  objectives: [{ id: 'enter_city', status: 'active', step: 'at_gate' }],
  sceneSeed: null,
  sceneSkeleton: null,
  memory: { heardRumors: [], innVisited: false },
  pendingChoices: [
    { id: 'observe_guard', label: 'observe guard' },
    { id: 'talk_guard', label: 'talk guard' },
    { id: 'wait', label: 'wait' },
  ],
})

const shouldUseDirector = (state: WorldState): boolean =>
  state.scene === 'inner_gate_scene' && !!state.sceneSeed && !!state.sceneSkeleton

const normalizeLoadedState = (loaded: WorldState): WorldState => {
  const anyLoaded = loaded as any
  const objectives =
    Array.isArray((loaded as any).objectives) && (loaded as any).objectives.length > 0
      ? (loaded as any).objectives
      : anyLoaded.objective
        ? [
            anyLoaded.objective,
            ...(anyLoaded.objectiveNext ? [anyLoaded.objectiveNext] : []),
          ]
        : [{ id: 'enter_city', status: 'active', step: 'at_gate' }]
  const legacyHeardRumors: unknown = anyLoaded.heardRumors
  const legacyMemoryHeardRumors: unknown = anyLoaded.memory?.heardRumors
  const legacyInnVisited: unknown = anyLoaded.innVisited
  const memory = anyLoaded.memory ?? {
    heardRumors: Array.isArray(legacyHeardRumors) ? legacyHeardRumors : [],
    innVisited: typeof legacyInnVisited === 'boolean' ? legacyInnVisited : false,
  }
  const heardRumorsRaw =
    Array.isArray(legacyMemoryHeardRumors) ? legacyMemoryHeardRumors : memory.heardRumors
  const heardRumors =
    Array.isArray(heardRumorsRaw) && heardRumorsRaw.length > 0 && typeof heardRumorsRaw[0] === 'string'
      ? heardRumorsRaw.map((t: string, i: number) => ({
          id: `legacy:${i}`,
          text: t,
          sourceType: 'legacy',
        }))
      : Array.isArray(heardRumorsRaw)
        ? heardRumorsRaw
        : []
  const innVisited = typeof memory.innVisited === 'boolean' ? memory.innVisited : false
  return {
    ...loaded,
    guardDisposition: loaded.guardDisposition ?? 'neutral',
    admitted: loaded.admitted ?? false,
    objectives,
    sceneSeed: (loaded as any).sceneSeed ?? null,
    sceneSkeleton: (loaded as any).sceneSkeleton ?? null,
    memory: { heardRumors, innVisited },
  }
}

const toTurnText = (args: string, scene: WorldState['scene']): string => {
  const t = args.trim()
  if (scene === 'inner_gate_scene') {
    if (t === '' || t === 'continue') return 'choose head_in'
    if (t === 'observe') return 'choose look_around'
    if (/^choose\s+\S+/.test(t)) return t
    return t
  }
  if (t === '' || t === 'continue') return 'choose wait'
  if (t === 'observe') return 'choose observe_guard'
  if (/^talk\s+\S+/.test(t)) return 'choose talk_guard'
  if (/^choose\s+\S+/.test(t)) return t
  return t
}

const formatOutput = (res: TurnResult): string => {
  const payload = {
    message: res.message,
    choices: res.choices,
    eventId: res.eventId,
    meta: res.meta,
  }
  return JSON.stringify(payload, null, 2)
}

export const call = async (args: string): Promise<LocalCommandResult> => {
  const loaded = await loadState()
  const prior =
    loaded &&
    (loaded as Partial<WorldState>).scene &&
    typeof (loaded as any).sceneEntered === 'boolean'
      ? normalizeLoadedState(loaded as WorldState)
      : defaultState()
  const actorId = 'player'
  const rawText = args.trim()
  const canonicalText = toTurnText(args, prior.scene)

  if (shouldUseDirector(prior)) {
    const decided = await director.decide({
      actorId,
      rawText,
      canonicalText,
      state: prior,
    })
    const validated = validateDirectorResult(prior, decided)
    const delta = {
      ...validated.delta,
      logAppend: [makeRecord(actorId, 'director_turn', validated.logSummary)],
    }
    const after = applyDelta(prior, delta)
    const result: TurnResult = {
      stateAfter: after,
      message: validated.message,
      choices: validated.choices,
      eventId: 'director_turn',
      meta: {
        moveId: after.sceneSkeleton?.lastMoveId,
        seedId: after.sceneSeed?.seedId,
        sceneId: after.sceneSkeleton?.sceneId,
      },
    }
    if (delta.logAppend && delta.logAppend.length > 0) {
      for (const rec of delta.logAppend) await appendEvent(rec)
    }
    await saveState(after)
    return { type: 'text', value: formatOutput(result) }
  }

  const input: TurnInput = { actorId, text: canonicalText }
  const def = parseEvent(input, prior)
  const delta = def.toDelta(input, prior)
  const after = applyDelta(prior, delta)
  const message = def.describe(after)
  const choices: Choice[] = def.choices ? def.choices(after) : defaultChoicesForState(after)
  const result: TurnResult = {
    stateAfter: after,
    message,
    choices,
    eventId: def.id,
    meta: {
      moveId: after.sceneSkeleton?.lastMoveId,
      seedId: after.sceneSeed?.seedId,
      sceneId: after.sceneSkeleton?.sceneId,
    },
  }
  if (delta.logAppend && delta.logAppend.length > 0) {
    for (const rec of delta.logAppend) await appendEvent(rec)
  }
  await saveState(after)
  return { type: 'text', value: formatOutput(result) }
}

