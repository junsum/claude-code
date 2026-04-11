export const gateEnterMessage =
  'You arrive at a weathered city gate. A lone guard watches the road with a weary gaze.\nObjective: Enter the city.'

export const gateObserveMessage = (isCurious: boolean): string =>
  isCurious
    ? 'He notices your attention; curiosity sharpens his gaze.'
    : 'The guard stands steady, routine vigilance undisturbed.'

export const gateTalkMessage = (isFriendly: boolean): string =>
  isFriendly
    ? 'The guard eases a smile: "Alright then—no trouble, yes?"'
    : 'He nods curtly: "State your business."'

export const gateRequestEntryMessage =
  'The guard relents and unbars the gate, waving you inside.'

export const gateWaitMessage = (turn: number, isNeutral: boolean): string =>
  isNeutral
    ? `Turn ${turn}: You wait; the guard’s attention drifts.`
    : `Turn ${turn}: You wait by the gate.`

export const innerEnterMessage =
  'Inside the gatehouse, lantern light spills across stone. The city hums beyond the archway.\nObjective: Enter the city.'

export const innerLookAroundMessage =
  'You take in the gatehouse: posted notices, worn benches, and the quiet rhythm of passing guards.'

export const innerHeadInMessage = (turn: number): string =>
  `Turn ${turn}: You step into the city.\nObjective complete: Enter the city.`

export const innerSeekInnMessage =
  'You find a modest inn nearby.\nNew objective complete: Find an inn.'

export const dynamicMoveMessage = (args: {
  locationType: string
  tension: string
  npcRoles: string[]
  lastMoveId?: string
  shortDescription: string
  innVisited?: boolean
  heardRumors?: Array<{ text: string }>
}): string => {
  const move = args.lastMoveId ? args.lastMoveId.replace(/_/g, ' ') : 'move'
  const location =
    args.locationType === 'inn'
      ? 'at the inn'
      : args.locationType === 'market'
        ? 'in the market'
        : 'on the street'
  const mood =
    args.tension === 'high'
      ? 'tension rises'
      : args.tension === 'medium'
        ? 'unease lingers'
        : 'calm holds'
  const npcs = args.npcRoles.length > 0 ? args.npcRoles.join(', ') : ''
  const npcLine = npcs ? `Nearby: ${npcs.replace(/_/g, ' ')}` : ''
  const rumorLine =
    args.heardRumors && args.heardRumors.length > 0
      ? `Rumors heard: ${args.heardRumors.length}`
      : ''
  const lastRumorLine =
    args.heardRumors && args.heardRumors.length > 0
      ? `Last rumor: ${args.heardRumors[args.heardRumors.length - 1].text}`
      : ''
  const innLine = args.innVisited ? 'You have been to an inn.' : ''
  return [
    `Move: ${move}`,
    `Location: ${location} (${mood})`,
    npcLine,
    rumorLine,
    lastRumorLine,
    innLine,
    args.shortDescription,
  ]
    .filter(Boolean)
    .join('\n')
}
