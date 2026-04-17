import type { DirectorInput } from './directorSchema.js'
import type { WorldState } from './types.js'

export type DirectorPrompt = {
  system: string
  user: string
  context: {
    scene: WorldState['scene']
    objectives: WorldState['objectives']
    memory: WorldState['memory']
    sceneSeed: WorldState['sceneSeed']
    sceneSkeleton: WorldState['sceneSkeleton']
    recentLog: WorldState['log']
  }
}

export const buildDirectorPrompt = (input: DirectorInput): DirectorPrompt => {
  const state = input.state
  const recentLog = state.log.slice(-8)
  return {
    system:
      [
        '你是world系统的导演层。',
        '你的职责：理解用户动作意图并给出结构化推进结果（动作后果、下一幕场景骨架、可选项）。',
        '输出必须是严格JSON对象，不能夹带解释文字。',
        'statePatch 只允许包含以下键：objectives、memory、sceneSeed、sceneSkeleton、pendingChoices、sceneEntered。',
      ].join('\n'),
    user: [
      `用户原始输入：${input.rawText}`,
      `规范化输入：${input.canonicalText}`,
      `当前场景：${state.scene}`,
      state.sceneSkeleton?.generatedSceneKind ? `当前阶段：${state.sceneSkeleton.generatedSceneKind}` : '',
      state.sceneSkeleton?.shortDescription ? `上一幕摘要：${state.sceneSkeleton.shortDescription}` : '',
      '',
      '请输出JSON，结构如下：',
      '{',
      '  "message": "string",',
      '  "choices": [{"id":"string","label":"string"}],',
      '  "statePatch": { ... },',
      '  "logSummary": "string"',
      '}',
    ]
      .filter(Boolean)
      .join('\n'),
    context: {
      scene: state.scene,
      objectives: state.objectives,
      memory: state.memory,
      sceneSeed: state.sceneSeed,
      sceneSkeleton: state.sceneSkeleton,
      recentLog,
    },
  }
}
