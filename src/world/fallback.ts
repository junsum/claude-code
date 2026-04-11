import type { Choice, EffectDelta, EventDefinition, EventRecord, WorldState } from './types.js'

const makeRecord = (actorId: string, eventId: string, summary: string): EventRecord => ({
  time: new Date().toISOString(),
  actorId,
  eventId,
  summary,
})

export const parseChooseId = (text: string): string | null => {
  const m = text.trim().match(/^choose\s+(\S+)/)
  return m ? m[1] : null
}

export const makeInvalidChooseEvent = (
  chooseId: string,
  choicesForState: (state: WorldState) => Choice[],
): EventDefinition => ({
  id: 'invalid_choose',
  matches: () => false,
  toDelta: (input, state): EffectDelta => ({
    logAppend: [
      makeRecord(input.actorId, 'invalid_choose', `invalid choice ${chooseId}`),
    ],
    pendingChoices: choicesForState(state),
  }),
  describe: () => `Invalid choice: ${chooseId}`,
  choices: (stateAfter) => choicesForState(stateAfter),
})

export const makeGateFallbackEvent = (
  raw: string,
  choicesForState: (state: WorldState) => Choice[],
): EventDefinition => ({
  id: 'gate_fallback',
  matches: () => false,
  toDelta: (input, state): EffectDelta => ({
    logAppend: [
      makeRecord(input.actorId, 'gate_fallback', `unrecognized input ${raw}`),
    ],
    pendingChoices: choicesForState(state),
  }),
  describe: () =>
    'Unrecognized input at the gate. Try /world choose observe_guard, /world choose talk_guard, or /world choose wait.',
  choices: (stateAfter) => choicesForState(stateAfter),
})

export const makeInnerFallbackEvent = (
  raw: string,
  choicesForState: (state: WorldState) => Choice[],
): EventDefinition => ({
  id: 'inner_fallback',
  matches: () => false,
  toDelta: (input, state): EffectDelta => ({
    logAppend: [
      makeRecord(input.actorId, 'inner_fallback', `unrecognized input ${raw}`),
    ],
    pendingChoices: choicesForState(state),
  }),
  describe: () =>
    'Unrecognized input in this scene. Try /world choose look_around or /world choose head_in.',
  choices: (stateAfter) => choicesForState(stateAfter),
})

