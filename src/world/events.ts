import type { Choice, EventDefinition, TurnInput, WorldState } from './types.js'
import {
  makeGateFallbackEvent,
  makeInnerFallbackEvent,
  makeInvalidChooseEvent,
  parseChooseId,
} from './fallback.js'
import { gateChoicesForState, gateSceneEvents, waitEvent } from './scenes/gateScene.js'
import { innerChoicesForState, innerGateSceneEvents } from './scenes/innerGateScene.js'

const choicesForState = (state: WorldState): Choice[] => {
  if (state.scene === 'gate_scene') return gateChoicesForState(state)
  return innerChoicesForState(state)
}

export const EVENT_DEFINITIONS: EventDefinition[] = [
  ...gateSceneEvents,
  ...innerGateSceneEvents,
  waitEvent,
]

export const parseEvent = (
  input: TurnInput,
  state: WorldState,
): EventDefinition => {
  for (const e of EVENT_DEFINITIONS) {
    if (e.matches(input, state)) return e
  }
  const chooseId = parseChooseId(input.text)
  if (chooseId) {
    return makeInvalidChooseEvent(chooseId, choicesForState)
  }
  const raw = input.text.trim()
  if (state.scene === 'inner_gate_scene') {
    return makeInnerFallbackEvent(raw, choicesForState)
  }
  return makeGateFallbackEvent(raw, choicesForState)
}

export const defaultChoicesForState = (state: WorldState): Choice[] =>
  state.pendingChoices ?? choicesForState(state)
