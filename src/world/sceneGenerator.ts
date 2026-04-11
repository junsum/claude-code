import type { Choice, DynamicMoveId, SceneSeed, SceneSkeleton, WorldState } from './types.js'
import { isObjectiveStatus } from './objectives.js'

export const generateSceneSeed = (state: WorldState, fromEventId: string): SceneSeed => ({
  seedId: `${fromEventId}:${state.turn}:${state.log.length}`,
  fromEventId,
  turn: state.turn,
})

export const generateSceneSkeleton = (state: WorldState, seed: SceneSeed): SceneSkeleton => {
  const enteredCity = isObjectiveStatus(state.objectives, 'enter_city', 'completed')
  const foundInn = isObjectiveStatus(state.objectives, 'find_inn', 'completed')
  const hasRumors = state.memory.heardRumors.length > 0
  if (foundInn) {
    const availableMoves: DynamicMoveId[] = ['order_drink', 'ask_rumors']
    if (hasRumors) availableMoves.push('follow_rumor')
    return {
      sceneId: `${seed.seedId}:${seed.lastMoveId ?? 'start'}`,
      sourceSeedId: seed.seedId,
      locationType: 'inn',
      tension: 'low',
      npcRoles: ['innkeeper', 'traveler'],
      availableMoves,
      lastMoveId: seed.lastMoveId,
      shortDescription: 'An inn common room murmurs with quiet conversation and warm lamplight.',
    }
  }
  if (enteredCity) {
    const availableMoves: DynamicMoveId[] = ['keep_walking', 'ask_rumors']
    if (hasRumors) availableMoves.push('follow_rumor')
    return {
      sceneId: `${seed.seedId}:${seed.lastMoveId ?? 'start'}`,
      sourceSeedId: seed.seedId,
      locationType: 'street',
      tension: 'medium',
      npcRoles: ['traveler', 'merchant'],
      availableMoves,
      lastMoveId: seed.lastMoveId,
      shortDescription: 'The city streets open ahead—busy, unfamiliar, and full of small risks.',
    }
  }
  return {
    sceneId: `${seed.seedId}:${seed.lastMoveId ?? 'start'}`,
    sourceSeedId: seed.seedId,
    locationType: 'street',
    tension: 'low',
    npcRoles: ['guard'],
    availableMoves: ['keep_walking'],
    lastMoveId: seed.lastMoveId,
    shortDescription: 'You hover near the threshold, weighing your next move.',
  }
}

export const sceneChoicesFromSkeleton = (sk: SceneSkeleton): Choice[] =>
  sk.availableMoves.map(m => ({ id: m, label: m.replace(/_/g, ' ') }))

export const advanceSceneSkeleton = (
  state: WorldState,
  seed: SceneSeed,
  moveId: DynamicMoveId,
): { seed: SceneSeed; skeleton: SceneSkeleton } => {
  const nextSeed: SceneSeed = { ...seed, lastMoveId: moveId, turn: state.turn }
  const base = generateSceneSkeleton(state, nextSeed)
  if (moveId === 'ask_rumors') {
    return {
      seed: nextSeed,
      skeleton: {
        ...base,
        tension: 'medium',
        lastMoveId: moveId,
        shortDescription: 'Rumors ripple through the room—some helpful, some dangerous.',
      },
    }
  }
  if (moveId === 'order_drink') {
    return {
      seed: nextSeed,
      skeleton: {
        ...base,
        tension: 'low',
        lastMoveId: moveId,
        shortDescription: 'A warm drink settles your nerves as the night carries on.',
      },
    }
  }
  if (moveId === 'follow_rumor') {
    const last =
      state.memory.heardRumors.length > 0
        ? state.memory.heardRumors[state.memory.heardRumors.length - 1].text
        : 'a faint lead'
    return {
      seed: nextSeed,
      skeleton: {
        ...base,
        tension: 'high',
        lastMoveId: moveId,
        shortDescription: `You follow the latest rumor into a darker lane: ${last}`,
      },
    }
  }
  return {
    seed: nextSeed,
    skeleton: {
      ...base,
      tension: 'medium',
      lastMoveId: moveId,
      shortDescription: 'You press onward, letting the crowd carry you into the next moment.',
    },
  }
}
