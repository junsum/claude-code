const GATE_TEXT = {
  enter: '你来到一座风化的城门前。孤身守卫带着倦意注视着来路。\n目标：进入城市。',
  observe: {
    curious: '他察觉到你的打量，目光里多了几分好奇。',
    steady: '守卫站姿沉稳，例行警戒并未被打破。',
  },
  talk: {
    friendly: '守卫神情放松，笑了笑：“好吧，别惹事就行。”',
    curt: '他简短点头：“说说你来做什么。”',
  },
  requestEntry: '守卫终于松口，抬起门闩，示意你进入。',
  wait: {
    neutral: (turn: number) => `第 ${turn} 回合：你原地等待，守卫的注意力慢慢移开。`,
    byGate: (turn: number) => `第 ${turn} 回合：你在城门旁静静等待。`,
  },
} as const

const INNER_TEXT = {
  enter: '你走进门楼，灯火映在石面上。拱门外，城市的喧声隐约传来。\n目标：进入城市。',
  lookAround: '你环顾门楼：告示贴在墙上，长椅磨损明显，守卫来回巡行有着固定节奏。',
  headIn: (turn: number) => `第 ${turn} 回合：你正式踏入城中。\n目标完成：进入城市。`,
  seekInn: '你在附近找到一家朴素的小客栈。\n新目标完成：找到客栈。',
} as const

const MOVE_LABEL: Record<string, string> = {
  keep_walking: '继续前行',
  ask_rumors: '打听传闻',
  order_drink: '点一杯酒',
  follow_rumor: '追随线索',
}

const ROLE_LABEL: Record<string, string> = {
  innkeeper: '掌柜',
  traveler: '旅人',
  guard: '守卫',
  merchant: '商贩',
}

const SCENE_KIND_LABEL: Record<string, string> = {
  threshold_pause: '门前停驻',
  street_roam: '街巷游移',
  inn_rest: '客栈歇脚',
  rumor_listening: '探听线索',
  rumor_trail: '循线追踪',
}

const FOCUS_BY_KIND: Record<string, string> = {
  rumor_trail: '你收紧注意力，沿着线索向前逼近。',
  rumor_listening: '你把重心放在收集与筛选信息上。',
  inn_rest: '你放缓节奏，在短暂的安稳里观察细节。',
  street_roam: '你随人流穿行，机会与麻烦并肩而来。',
  threshold_pause: '你先稳住呼吸，评估局势与下一步。',
}

const LAYOUT_BY_KIND: Record<string, Array<keyof ReturnType<typeof buildLines>>> = {
  rumor_trail: ['action', 'stage', 'location', 'focus', 'lastRumor', 'npc', 'rumorCount', 'short'],
  rumor_listening: ['action', 'stage', 'location', 'focus', 'rumorCount', 'lastRumor', 'npc', 'inn', 'short'],
  inn_rest: ['action', 'stage', 'location', 'focus', 'npc', 'inn', 'rumorCount', 'lastRumor', 'short'],
  street_roam: ['action', 'stage', 'location', 'focus', 'npc', 'rumorCount', 'lastRumor', 'short'],
  threshold_pause: ['action', 'stage', 'location', 'focus', 'npc', 'short'],
}

const joinLines = (lines: Array<string | null | undefined>): string =>
  lines.filter(Boolean).join('\n')

const buildLines = (args: {
  move: string
  sceneKind: string
  location: string
  mood: string
  focusLine: string
  npcLine: string
  rumorLine: string
  lastRumorLine: string
  innLine: string
  shortDescription: string
}) => ({
  action: `行动：${args.move}`,
  stage: args.sceneKind ? `阶段：${args.sceneKind}` : '',
  location: `地点：${args.location}（${args.mood}）`,
  focus: args.focusLine,
  npc: args.npcLine,
  rumorCount: args.rumorLine,
  lastRumor: args.lastRumorLine,
  inn: args.innLine,
  short: args.shortDescription,
})

export const gateEnterMessage = GATE_TEXT.enter

export const gateObserveMessage = (isCurious: boolean): string =>
  isCurious ? GATE_TEXT.observe.curious : GATE_TEXT.observe.steady

export const gateTalkMessage = (isFriendly: boolean): string =>
  isFriendly ? GATE_TEXT.talk.friendly : GATE_TEXT.talk.curt

export const gateRequestEntryMessage =
  GATE_TEXT.requestEntry

export const gateWaitMessage = (turn: number, isNeutral: boolean): string =>
  isNeutral ? GATE_TEXT.wait.neutral(turn) : GATE_TEXT.wait.byGate(turn)

export const innerEnterMessage =
  INNER_TEXT.enter

export const innerLookAroundMessage =
  INNER_TEXT.lookAround

export const innerHeadInMessage = (turn: number): string =>
  INNER_TEXT.headIn(turn)

export const innerSeekInnMessage =
  INNER_TEXT.seekInn

export const dynamicMoveMessage = (args: {
  generatedSceneKind?: string
  locationType: string
  tension: string
  npcRoles: string[]
  lastMoveId?: string
  shortDescription: string
  innVisited?: boolean
  heardRumors?: Array<{ text: string }>
}): string => {
  const move = args.lastMoveId ? (MOVE_LABEL[args.lastMoveId] ?? args.lastMoveId) : '行动'
  const sceneKind = args.generatedSceneKind
    ? SCENE_KIND_LABEL[args.generatedSceneKind] ?? args.generatedSceneKind
    : ''
  const location =
    args.locationType === 'inn'
      ? '客栈'
      : args.locationType === 'market'
        ? '集市'
        : '街巷'
  const mood =
    args.tension === 'high'
      ? '紧张升高'
      : args.tension === 'medium'
        ? '隐忧未散'
        : '氛围平稳'
  const npcs =
    args.npcRoles.length > 0
      ? args.npcRoles.map(role => ROLE_LABEL[role] ?? role).join('、')
      : ''
  const npcLine = npcs ? `附近人物：${npcs}` : ''
  const rumorLine =
    args.heardRumors && args.heardRumors.length > 0
      ? `已获传闻：${args.heardRumors.length}`
      : ''
  const lastRumorLine =
    args.heardRumors && args.heardRumors.length > 0
      ? `最新线索：${args.heardRumors[args.heardRumors.length - 1].text}`
      : ''
  const innLine = args.innVisited ? '你已经到过客栈。' : ''
  const kind = args.generatedSceneKind ?? ''
  const focusLine = FOCUS_BY_KIND[kind] ?? ''

  const lines = buildLines({
    move,
    sceneKind,
    location,
    mood,
    focusLine,
    npcLine,
    rumorLine,
    lastRumorLine,
    innLine,
    shortDescription: args.shortDescription,
  })

  const layout =
    kind && LAYOUT_BY_KIND[kind]
      ? LAYOUT_BY_KIND[kind]
      : (['action', 'stage', 'location', 'npc', 'rumorCount', 'lastRumor', 'inn', 'short'] as const)

  return joinLines(layout.map(k => lines[k]))
}
