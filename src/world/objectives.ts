import type { ObjectiveId, ObjectiveState } from './types.js'

export const findObjective = <T extends ObjectiveId>(
  objectives: readonly ObjectiveState[],
  id: T,
): Extract<ObjectiveState, { id: T }> | undefined =>
  objectives.find(o => o.id === id) as Extract<ObjectiveState, { id: T }> | undefined

export const hasObjective = (
  objectives: readonly ObjectiveState[],
  id: ObjectiveId,
): boolean => objectives.some(o => o.id === id)

export const isObjectiveStatus = (
  objectives: readonly ObjectiveState[],
  id: ObjectiveId,
  status: ObjectiveState['status'],
): boolean => objectives.some(o => o.id === id && o.status === status)

export const upsertObjective = (
  objectives: readonly ObjectiveState[],
  next: ObjectiveState,
): ObjectiveState[] => {
  const has = objectives.some(o => o.id === next.id)
  if (!has) return [...objectives, next]
  return objectives.map(o => (o.id === next.id ? next : o))
}

export const updateObjective = <T extends ObjectiveId>(
  objectives: readonly ObjectiveState[],
  id: T,
  updater: (prev: Extract<ObjectiveState, { id: T }>) => Extract<ObjectiveState, { id: T }>,
): ObjectiveState[] =>
  objectives.map(o => (o.id === id ? updater(o as any) : o))

