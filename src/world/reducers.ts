import type { EffectDelta, EventRecord, WorldState } from './types.js'

export const applyDelta = (state: WorldState, delta: EffectDelta): WorldState => {
  const turn = state.turn + (delta.turnInc ?? 0)
  const players = { ...state.players }
  if (delta.playerPatches) {
    for (const p of delta.playerPatches) {
      const prev = players[p.playerId] || { id: p.playerId, name: p.playerId }
      players[p.playerId] = { ...prev, ...p.patch }
    }
  }
  const worldNotes = delta.worldNotesAppend
    ? [...state.worldNotes, ...delta.worldNotesAppend]
    : state.worldNotes
  const log: EventRecord[] = delta.logAppend
    ? [...state.log, ...delta.logAppend]
    : state.log
  const pendingChoices = delta.pendingChoices === null ? undefined : delta.pendingChoices ?? state.pendingChoices
  const next: WorldState = {
    ...state,
    turn,
    players,
    worldNotes,
    log,
    meta: { createdAt: state.meta.createdAt, updatedAt: new Date().toISOString() },
    pendingChoices,
  }
  return delta.statePatch ? { ...next, ...delta.statePatch } : next
}

