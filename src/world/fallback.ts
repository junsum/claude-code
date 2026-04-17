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

const formatChoicesHint = (state: WorldState, choicesForState: (state: WorldState) => Choice[]): string => {
  const choices = choicesForState(state)
  if (choices.length === 0) return ''
  return choices.map(choice => `/world choose ${choice.id}`).join('、')
}

const innerFallbackPrefix = (state: WorldState): string => {
  const kind = state.sceneSkeleton?.generatedSceneKind
  if (kind === 'rumor_trail') return '你正处在循线追踪阶段'
  if (kind === 'rumor_listening') return '你正处在探听线索阶段'
  if (kind === 'inn_rest') return '你正处在客栈歇脚阶段'
  if (kind === 'street_roam') return '你正处在街巷游移阶段'
  return '你正处在当前场景阶段'
}

const describeInvalidChoose = (
  chooseId: string,
  stateAfter: WorldState,
  choicesForState: (state: WorldState) => Choice[],
): string => {
  if (stateAfter.scene !== 'inner_gate_scene') return `无效选项：${chooseId}`
  const hint = formatChoicesHint(stateAfter, choicesForState)
  return hint
    ? `${innerFallbackPrefix(stateAfter)}，不能执行“${chooseId}”。可尝试：${hint}。`
    : `${innerFallbackPrefix(stateAfter)}，不能执行“${chooseId}”。`
}

const describeInnerFallback = (
  stateAfter: WorldState,
  choicesForState: (state: WorldState) => Choice[],
): string => {
  const hint = formatChoicesHint(stateAfter, choicesForState)
  return hint
    ? `${innerFallbackPrefix(stateAfter)}，这条输入没有对应动作。可尝试：${hint}。`
    : `${innerFallbackPrefix(stateAfter)}，这条输入没有对应动作。`
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
  describe: (stateAfter) => describeInvalidChoose(chooseId, stateAfter, choicesForState),
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
    '城门前无法识别这条输入。可尝试：/world choose observe_guard、/world choose talk_guard、/world choose wait。',
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
  describe: (stateAfter) => describeInnerFallback(stateAfter, choicesForState),
  choices: (stateAfter) => choicesForState(stateAfter),
})
