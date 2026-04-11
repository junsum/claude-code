import type {
  Choice,
  EffectDelta,
  EventDefinition,
  EventRecord,
  WorldState,
} from '../types.js'
import { innerChoicesAll } from './innerGateScene.js'
import { updateObjective } from '../objectives.js'
import {
  gateEnterMessage,
  gateObserveMessage,
  gateRequestEntryMessage,
  gateTalkMessage,
  gateWaitMessage,
} from '../narration.js'

const makeRecord = (actorId: string, eventId: string, summary: string): EventRecord => ({
  time: new Date().toISOString(),
  actorId,
  eventId,
  summary,
})

const gateChoicesAll = [
  { id: 'observe_guard', label: 'observe guard' },
  { id: 'talk_guard', label: 'talk guard' },
  { id: 'wait', label: 'wait' },
] as const

const requestEntryChoice: Choice = { id: 'request_entry', label: 'request entry' }

const gateChoicesByDisposition = (
  disp: WorldState['guardDisposition'],
  admitted: boolean,
): Choice[] => {
  if (admitted) return []
  if (disp === 'neutral') return [...gateChoicesAll]
  if (disp === 'curious') return [gateChoicesAll[1], gateChoicesAll[2]]
  return [requestEntryChoice, gateChoicesAll[1], gateChoicesAll[2]]
}

export const gateChoicesForState = (state: WorldState): Choice[] =>
  gateChoicesByDisposition(state.guardDisposition, state.admitted)

export const enterGateScene: EventDefinition = {
  id: 'enter_gate_scene',
  matches: (_input, state) => state.scene === 'gate_scene' && !state.sceneEntered,
  toDelta: (input, state): EffectDelta => ({
    statePatch: { sceneEntered: true },
    logAppend: [makeRecord(input.actorId, 'enter_gate_scene', 'enter gate scene')],
    pendingChoices: gateChoicesForState({ ...state, sceneEntered: true }),
  }),
  describe: () => gateEnterMessage,
  choices: (stateAfter) => gateChoicesForState(stateAfter),
}

export const observeGuard: EventDefinition = {
  id: 'observe_guard',
  matches: (input, state) =>
    state.scene === 'gate_scene' &&
    (input.text.trim() === 'choose observe_guard' || input.text.trim() === 'observe'),
  toDelta: (input, state): EffectDelta => {
    const nextDisp =
      state.guardDisposition === 'neutral' ? 'curious' : state.guardDisposition
    return {
      statePatch: { guardDisposition: nextDisp },
      logAppend: [
        makeRecord(
          input.actorId,
          'observe_guard',
          nextDisp === 'curious'
            ? 'you study the guard; he notices and grows curious'
            : 'you study the guard; calm and watchful',
        ),
      ],
      pendingChoices: gateChoicesByDisposition(nextDisp, state.admitted),
    }
  },
  describe: (stateAfter) => gateObserveMessage(stateAfter.guardDisposition === 'curious'),
  choices: (stateAfter) => gateChoicesForState(stateAfter),
}

export const talkGuard: EventDefinition = {
  id: 'talk_guard',
  matches: (input, state) =>
    state.scene === 'gate_scene' &&
    (input.text.trim() === 'choose talk_guard' || /^talk\s+\S+/.test(input.text.trim())),
  toDelta: (input, state): EffectDelta => {
    const nextDisp =
      state.guardDisposition === 'neutral'
        ? 'curious'
        : state.guardDisposition === 'curious'
          ? 'friendly'
          : 'friendly'
    const summary =
      nextDisp === 'curious'
        ? 'you greet the guard; he asks your business'
        : 'you exchange a few words; his tone warms'
    return {
      statePatch: { guardDisposition: nextDisp },
      logAppend: [makeRecord(input.actorId, 'talk_guard', summary)],
      pendingChoices: gateChoicesByDisposition(nextDisp, state.admitted),
    }
  },
  describe: (stateAfter) => gateTalkMessage(stateAfter.guardDisposition === 'friendly'),
  choices: (stateAfter) => gateChoicesForState(stateAfter),
}

export const requestEntry: EventDefinition = {
  id: 'request_entry',
  matches: (input, state) =>
    state.scene === 'gate_scene' &&
    input.text.trim() === 'choose request_entry' &&
    state.guardDisposition === 'friendly' &&
    !state.admitted,
  toDelta: (input, state): EffectDelta => ({
    statePatch: {
      admitted: true,
      scene: 'inner_gate_scene',
      sceneEntered: false,
      objectives: updateObjective(state.objectives, 'enter_city', o => ({
        ...o,
        step: 'inside_gatehouse',
      })),
    },
    logAppend: [makeRecord(input.actorId, 'request_entry', 'the guard grants entry')],
    pendingChoices: [...innerChoicesAll],
  }),
  describe: () => gateRequestEntryMessage,
  choices: () => [...innerChoicesAll],
}

export const waitEvent: EventDefinition = {
  id: 'wait',
  matches: (input, state) =>
    state.scene === 'gate_scene' &&
    (input.text.trim() === 'choose wait' ||
      input.text.trim() === 'continue' ||
      input.text.trim() === ''),
  toDelta: (input, state): EffectDelta => {
    const nextDisp =
      state.guardDisposition === 'curious' ? 'neutral' : state.guardDisposition
    return {
      turnInc: 1,
      statePatch: { guardDisposition: nextDisp },
      logAppend: [
        makeRecord(
          input.actorId,
          'wait',
          nextDisp !== state.guardDisposition
            ? 'you wait; the guard loses interest'
            : 'you wait by the gate as time passes',
        ),
      ],
      pendingChoices: gateChoicesByDisposition(nextDisp, state.admitted),
    }
  },
  describe: (stateAfter) =>
    gateWaitMessage(stateAfter.turn, stateAfter.guardDisposition === 'neutral'),
  choices: (stateAfter) => gateChoicesForState(stateAfter),
}

export const gateSceneEvents: EventDefinition[] = [
  enterGateScene,
  observeGuard,
  talkGuard,
  requestEntry,
]
