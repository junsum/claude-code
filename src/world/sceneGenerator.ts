import type {
  Choice,
  DynamicMoveId,
  GeneratedSceneKind,
  SceneSeed,
  SceneSkeleton,
  WorldState,
} from './types.js'
import { isObjectiveStatus } from './objectives.js'

export const generateSceneSeed = (state: WorldState, fromEventId: string): SceneSeed => ({
  seedId: `${fromEventId}:${state.turn}:${state.log.length}`,
  fromEventId,
  turn: state.turn,
})

export const sceneChoicesFromSkeleton = (sk: SceneSkeleton): Choice[] =>
  sk.availableMoves.map(m => ({
    id: m,
    label:
      m === 'keep_walking'
        ? '继续前行'
        : m === 'ask_rumors'
          ? '打听传闻'
          : m === 'order_drink'
            ? '点一杯酒'
            : m === 'follow_rumor'
              ? '追随线索'
              : m.replace(/_/g, ' '),
  }))

const latestRumor = (state: WorldState) =>
  state.memory.heardRumors.length > 0
    ? state.memory.heardRumors[state.memory.heardRumors.length - 1]
    : null

const followRumorNpcRoles = (state: WorldState): SceneSkeleton['npcRoles'] => {
  const rumor = latestRumor(state)
  if (!rumor) return ['traveler', 'merchant']
  return rumor.sourceType === 'legacy'
    ? ['guard', 'merchant']
    : ['traveler', 'guard']
}

const baseStreetMoves = (hasRumors: boolean): DynamicMoveId[] => {
  const availableMoves: DynamicMoveId[] = ['keep_walking', 'ask_rumors']
  if (hasRumors) availableMoves.push('follow_rumor')
  return availableMoves
}

const baseInnMoves = (hasRumors: boolean): DynamicMoveId[] => {
  const availableMoves: DynamicMoveId[] = ['order_drink', 'ask_rumors']
  if (hasRumors) availableMoves.push('follow_rumor')
  return availableMoves
}

const movesForGeneratedSceneKind = (
  kind: GeneratedSceneKind,
  hasRumors: boolean,
  inInn: boolean,
): DynamicMoveId[] => {
  if (kind === 'threshold_pause') return ['keep_walking']
  if (kind === 'street_roam') return baseStreetMoves(hasRumors)
  if (kind === 'inn_rest') return baseInnMoves(hasRumors)
  if (kind === 'rumor_listening') {
    if (inInn) {
      return hasRumors
        ? ['follow_rumor', 'ask_rumors', 'order_drink']
        : ['ask_rumors', 'order_drink']
    }
    return hasRumors
      ? ['follow_rumor', 'ask_rumors', 'keep_walking']
      : ['ask_rumors', 'keep_walking']
  }
  return hasRumors ? ['follow_rumor', 'keep_walking'] : ['keep_walking']
}

const determineGeneratedSceneKind = (
  state: WorldState,
  seed: SceneSeed,
): GeneratedSceneKind => {
  const enteredCity = isObjectiveStatus(state.objectives, 'enter_city', 'completed')
  const foundInn = isObjectiveStatus(state.objectives, 'find_inn', 'completed')

  if (!enteredCity) return 'threshold_pause'
  if (seed.lastMoveId === 'follow_rumor' && state.memory.heardRumors.length > 0) {
    return 'rumor_trail'
  }
  if (seed.lastMoveId === 'ask_rumors') return 'rumor_listening'
  if (seed.lastMoveId === 'order_drink' || foundInn || state.memory.innVisited) {
    return 'inn_rest'
  }
  return 'street_roam'
}

export const generateSceneSkeleton = (state: WorldState, seed: SceneSeed): SceneSkeleton => {
  const hasRumors = state.memory.heardRumors.length > 0
  const rumor = latestRumor(state)
  const kind = determineGeneratedSceneKind(state, seed)
  const inInn =
    kind === 'inn_rest' ||
    (kind === 'rumor_listening' &&
      (isObjectiveStatus(state.objectives, 'find_inn', 'completed') || state.memory.innVisited))

  if (kind === 'threshold_pause') {
    return {
      sceneId: `${seed.seedId}:${seed.lastMoveId ?? 'start'}`,
      sourceSeedId: seed.seedId,
      generatedSceneKind: kind,
      locationType: 'street',
      tension: 'low',
      npcRoles: ['guard'],
      availableMoves: movesForGeneratedSceneKind(kind, hasRumors, false),
      lastMoveId: seed.lastMoveId,
      shortDescription: '你停在门槛附近，反复权衡下一步。',
    }
  }

  if (kind === 'inn_rest') {
    return {
      sceneId: `${seed.seedId}:${seed.lastMoveId ?? 'start'}`,
      sourceSeedId: seed.seedId,
      generatedSceneKind: kind,
      locationType: 'inn',
      tension: seed.lastMoveId === 'order_drink' ? 'low' : 'low',
      npcRoles: ['innkeeper', 'traveler'],
      availableMoves: movesForGeneratedSceneKind(kind, hasRumors, true),
      lastMoveId: seed.lastMoveId,
      shortDescription:
        seed.lastMoveId === 'order_drink'
          ? '一杯温热的酒下肚，心绪稍定，夜色仍在缓慢推进。'
          : '客栈大堂里低声交谈不断，暖黄灯火让空气稍显安稳。',
    }
  }

  if (kind === 'rumor_listening') {
    return {
      sceneId: `${seed.seedId}:${seed.lastMoveId ?? 'start'}`,
      sourceSeedId: seed.seedId,
      generatedSceneKind: kind,
      locationType: inInn ? 'inn' : 'street',
      tension: 'medium',
      npcRoles: inInn ? ['innkeeper', 'traveler'] : ['traveler', 'merchant'],
      availableMoves: movesForGeneratedSceneKind(kind, hasRumors, inInn),
      lastMoveId: seed.lastMoveId,
      shortDescription: inInn
        ? '你在客栈角落里侧耳倾听，零碎消息在杯盏碰撞间慢慢拼合。'
        : '你放慢脚步向路人探问，零碎传闻在街声里逐渐连成一线。',
    }
  }

  if (kind === 'rumor_trail') {
    const last = rumor ? rumor.text : '一条模糊线索'
    const tension = state.memory.heardRumors.length >= 2 ? 'high' : 'medium'
    const sourceHint = rumor?.sourceType === 'legacy' ? '一段旧日耳语' : '一条刚听来的酒馆线索'
    return {
      sceneId: `${seed.seedId}:${seed.lastMoveId ?? 'start'}`,
      sourceSeedId: seed.seedId,
      generatedSceneKind: kind,
      locationType: 'street',
      tension,
      npcRoles: followRumorNpcRoles(state),
      availableMoves: movesForGeneratedSceneKind(kind, hasRumors, false),
      lastMoveId: seed.lastMoveId,
      shortDescription: `你离开主路，顺着${sourceHint}拐入更狭窄的巷道：${last}`,
    }
  }

  return {
    sceneId: `${seed.seedId}:${seed.lastMoveId ?? 'start'}`,
    sourceSeedId: seed.seedId,
    generatedSceneKind: kind,
    locationType: 'street',
    tension: 'medium',
    npcRoles: ['traveler', 'merchant'],
    availableMoves: movesForGeneratedSceneKind(kind, hasRumors, false),
    lastMoveId: seed.lastMoveId,
    shortDescription:
      seed.lastMoveId === 'keep_walking'
        ? '你继续向前，被人潮推着走进下一个片刻。'
        : '城中街道在前方铺开，人群熙攘而陌生，处处藏着细小变数。',
  }
}

export const advanceSceneSkeleton = (
  state: WorldState,
  seed: SceneSeed,
  moveId: DynamicMoveId,
): { seed: SceneSeed; skeleton: SceneSkeleton } => {
  const nextSeed: SceneSeed = { ...seed, lastMoveId: moveId, turn: state.turn }
  return { seed: nextSeed, skeleton: generateSceneSkeleton(state, nextSeed) }
}
