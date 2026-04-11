import type {
  Choice,
  EffectDelta,
  EventDefinition,
  EventRecord,
  RumorMemoryItem,
  WorldState,
} from '../types.js'
import { isObjectiveStatus, upsertObjective, updateObjective } from '../objectives.js'
import {
  innerEnterMessage,
  innerHeadInMessage,
  innerLookAroundMessage,
  innerSeekInnMessage,
  dynamicMoveMessage,
} from '../narration.js'
import {
  advanceSceneSkeleton,
  generateSceneSeed,
  generateSceneSkeleton,
  sceneChoicesFromSkeleton,
} from '../sceneGenerator.js'

const makeRecord = (actorId: string, eventId: string, summary: string): EventRecord => ({
  time: new Date().toISOString(),
  actorId,
  eventId,
  summary,
})

const MAX_RUMORS = 20

const normalizeRumorText = (text: string): string => text.trim().replace(/\s+/g, ' ')

const governRumors = (items: RumorMemoryItem[]): RumorMemoryItem[] => {
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

export const innerChoicesAll = [
  { id: 'look_around', label: 'look around' },
  { id: 'head_in', label: 'head into city' },
] as const satisfies readonly Choice[]

const completedChoices: Choice[] = [{ id: 'look_around', label: 'look around' }]
const postCompletionChoices: Choice[] = [
  { id: 'seek_inn', label: 'seek inn' },
  { id: 'look_around', label: 'look around' },
]

export const innerChoicesForState = (state: WorldState): Choice[] =>
  isObjectiveStatus(state.objectives, 'enter_city', 'completed')
    ? isObjectiveStatus(state.objectives, 'find_inn', 'active')
      ? postCompletionChoices
      : state.sceneSkeleton
        ? [...sceneChoicesFromSkeleton(state.sceneSkeleton), ...completedChoices]
        : completedChoices
    : [...innerChoicesAll]

export const enterInnerGateScene: EventDefinition = {
  id: 'enter_inner_gate_scene',
  matches: (_input, state) => state.scene === 'inner_gate_scene' && !state.sceneEntered,
  toDelta: (input, state): EffectDelta => ({
    statePatch: { sceneEntered: true },
    logAppend: [
      makeRecord(input.actorId, 'enter_inner_gate_scene', 'enter inner gate scene'),
    ],
    pendingChoices: innerChoicesForState(state),
  }),
  describe: () => innerEnterMessage,
  choices: (stateAfter) => innerChoicesForState(stateAfter),
}

export const lookAround: EventDefinition = {
  id: 'look_around',
  matches: (input, state) =>
    state.scene === 'inner_gate_scene' && input.text.trim() === 'choose look_around',
  toDelta: (input, state): EffectDelta => ({
    logAppend: [
      makeRecord(input.actorId, 'look_around', 'you scan the gatehouse interior'),
    ],
    pendingChoices: innerChoicesForState(state),
  }),
  describe: () => innerLookAroundMessage,
  choices: (stateAfter) => innerChoicesForState(stateAfter),
}

export const headIn: EventDefinition = {
  id: 'head_in',
  matches: (input, state) =>
    state.scene === 'inner_gate_scene' &&
    !isObjectiveStatus(state.objectives, 'enter_city', 'completed') &&
    input.text.trim() === 'choose head_in',
  toDelta: (input, state): EffectDelta => ({
    turnInc: 1,
    statePatch: {
      objectives: upsertObjective(
        updateObjective(state.objectives, 'enter_city', o => ({
          ...o,
          status: 'completed',
          step: 'in_city',
        })),
        { id: 'find_inn', status: 'active', step: 'seeking' },
      ),
    },
    logAppend: [makeRecord(input.actorId, 'head_in', 'you head into the city')],
    pendingChoices: postCompletionChoices,
  }),
  describe: (stateAfter) => innerHeadInMessage(stateAfter.turn),
  choices: () => postCompletionChoices,
}

export const seekInn: EventDefinition = {
  id: 'seek_inn',
  matches: (input, state) =>
    state.scene === 'inner_gate_scene' &&
    isObjectiveStatus(state.objectives, 'enter_city', 'completed') &&
    isObjectiveStatus(state.objectives, 'find_inn', 'active') &&
    input.text.trim() === 'choose seek_inn',
  toDelta: (input, state): EffectDelta => {
    const objectives = updateObjective(state.objectives, 'find_inn', o => ({
      ...o,
      status: 'completed',
      step: 'found',
    }))
    const seededState: WorldState = { ...state, objectives }
    const sceneSeed = generateSceneSeed(seededState, 'seek_inn')
    const sceneSkeleton = generateSceneSkeleton(seededState, sceneSeed)
    return {
      statePatch: {
        objectives,
        sceneSeed,
        sceneSkeleton,
      },
      logAppend: [makeRecord(input.actorId, 'seek_inn', 'you find a nearby inn')],
      pendingChoices: [...sceneChoicesFromSkeleton(sceneSkeleton), ...completedChoices],
    }
  },
  describe: () => innerSeekInnMessage,
  choices: (stateAfter) =>
    stateAfter.sceneSkeleton
      ? [...sceneChoicesFromSkeleton(stateAfter.sceneSkeleton), ...completedChoices]
      : completedChoices,
}

export const dynamicMove: EventDefinition = {
  id: 'dynamic_move',
  matches: (input, state) => {
    if (state.scene !== 'inner_gate_scene') return false
    if (!state.sceneSkeleton || !state.sceneSeed) return false
    const m = input.text.trim().match(/^choose\s+(\S+)/)
    const choiceId = m ? m[1] : null
    if (!choiceId) return false
    return (state.sceneSkeleton.availableMoves as readonly string[]).includes(choiceId)
  },
  toDelta: (input, state): EffectDelta => {
    const m = input.text.trim().match(/^choose\s+(\S+)/)
    const choiceId = (m ? m[1] : '') as any
    const first = advanceSceneSkeleton(state, state.sceneSeed!, choiceId)
    const rumorId = `${state.sceneSeed?.seedId ?? 'seed'}:${state.turn}:${state.log.length}`
    const heardRumors =
      choiceId === 'ask_rumors'
        ? governRumors([
            ...state.memory.heardRumors,
            {
              id: rumorId,
              text: first.skeleton.shortDescription,
              sourceType: 'ask_rumors',
            },
          ])
        : state.memory.heardRumors
    const innVisited = choiceId === 'order_drink' ? true : state.memory.innVisited
    const advanced =
      choiceId === 'ask_rumors'
        ? advanceSceneSkeleton({ ...state, memory: { ...state.memory, heardRumors } }, state.sceneSeed!, choiceId)
        : first
    return {
      turnInc: 1,
      statePatch: {
        sceneSeed: advanced.seed,
        sceneSkeleton: advanced.skeleton,
        memory: { ...state.memory, heardRumors, innVisited },
      },
      logAppend: [
        makeRecord(
          input.actorId,
          'dynamic_move',
          `dynamic move ${String(choiceId)} -> ${advanced.skeleton.sceneId}`,
        ),
      ],
      pendingChoices: [...sceneChoicesFromSkeleton(advanced.skeleton), ...completedChoices],
    }
  },
  describe: (stateAfter) =>
    stateAfter.sceneSkeleton
      ? dynamicMoveMessage(
          {
            locationType: stateAfter.sceneSkeleton.locationType,
            tension: stateAfter.sceneSkeleton.tension,
            npcRoles: stateAfter.sceneSkeleton.npcRoles,
            lastMoveId: stateAfter.sceneSkeleton.lastMoveId,
            shortDescription: stateAfter.sceneSkeleton.shortDescription,
            innVisited: stateAfter.memory.innVisited,
            heardRumors: stateAfter.memory.heardRumors,
          },
        )
      : '',
  choices: (stateAfter) =>
    stateAfter.sceneSkeleton
      ? [...sceneChoicesFromSkeleton(stateAfter.sceneSkeleton), ...completedChoices]
      : completedChoices,
}

export const innerGateSceneEvents: EventDefinition[] = [
  enterInnerGateScene,
  lookAround,
  headIn,
  seekInn,
  dynamicMove,
]
