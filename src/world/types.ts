export type Choice = { id: string; label: string }

export type PlayerState = {
  id: string
  name: string
  traits?: string[]
  status?: { hp?: number; mood?: string }
  inventory?: string[]
}

export type EventRecord = {
  time: string
  actorId: string
  eventId: string
  summary: string
}

export type ObjectiveId = 'enter_city' | 'find_inn'

export type EnterCityObjective = {
  id: 'enter_city'
  status: 'active' | 'completed'
  step: 'at_gate' | 'inside_gatehouse' | 'in_city'
}

export type FindInnObjective = {
  id: 'find_inn'
  status: 'active' | 'completed'
  step: 'seeking' | 'found'
}

export type ObjectiveState = EnterCityObjective | FindInnObjective

export type DynamicMoveId = 'order_drink' | 'ask_rumors' | 'keep_walking' | 'follow_rumor'

export type GeneratedSceneKind =
  | 'threshold_pause'
  | 'street_roam'
  | 'inn_rest'
  | 'rumor_listening'
  | 'rumor_trail'

export type WorldMemory = {
  heardRumors: RumorMemoryItem[]
  innVisited: boolean
}

export type RumorSourceType = 'ask_rumors' | 'legacy'

export type RumorMemoryItem = {
  id: string
  text: string
  sourceType: RumorSourceType
}

export type WorldState = {
  turn: number
  players: Record<string, PlayerState>
  worldNotes: string[]
  log: EventRecord[]
  meta: { createdAt: string; updatedAt: string }
  scene: 'gate_scene' | 'inner_gate_scene'
  sceneEntered: boolean
  guardDisposition: 'neutral' | 'curious' | 'friendly'
  admitted: boolean
  objectives: ObjectiveState[]
  sceneSeed: SceneSeed | null
  sceneSkeleton: SceneSkeleton | null
  memory: WorldMemory
  pendingChoices?: Choice[]
}

export type SceneSeed = {
  seedId: string
  fromEventId: string
  turn: number
  lastMoveId?: DynamicMoveId
}

export type SceneSkeleton = {
  sceneId: string
  sourceSeedId: string
  generatedSceneKind?: GeneratedSceneKind
  locationType: 'street' | 'inn' | 'market'
  tension: 'low' | 'medium' | 'high'
  npcRoles: Array<'innkeeper' | 'traveler' | 'guard' | 'merchant'>
  availableMoves: DynamicMoveId[]
  lastMoveId?: DynamicMoveId
  shortDescription: string
}

export type TurnInput = {
  actorId: string
  text: string
  context?: { time?: string; location?: string }
}

export type EffectDelta = {
  turnInc?: number
  playerPatches?: Array<{ playerId: string; patch: Partial<PlayerState> }>
  worldNotesAppend?: string[]
  logAppend?: EventRecord[]
  pendingChoices?: Choice[] | null
  statePatch?: Partial<WorldState>
}

export type TurnResult = {
  stateAfter: WorldState
  message: string
  choices: Choice[]
  eventId?: string
  meta?: {
    moveId?: DynamicMoveId
    seedId?: string
    sceneId?: string
  }
}

export type EventDefinition = {
  id: string
  matches: (input: TurnInput, state: WorldState) => boolean
  toDelta: (input: TurnInput, state: WorldState) => EffectDelta
  describe: (stateAfter: WorldState) => string
  choices?: (stateAfter: WorldState) => Choice[]
}

