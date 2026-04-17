import type { DirectorResult } from './directorSchema.js'
import type { DirectorPrompt } from './directorPrompt.js'
import type { Choice, WorldState } from './types.js'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

export type DirectorProviderRequest = {
  input: { actorId: string; rawText: string; canonicalText: string; state: WorldState }
  prompt: DirectorPrompt
}

export type DirectorProvider = {
  decide: (req: DirectorProviderRequest) => Promise<DirectorResult>
}

export type SiliconFlowConfig = {
  apiKey: string
  baseURL: string
  model: string
  timeoutMs: number
}

type SiliconFlowLocalConfigFile = {
  apiKey?: string
  baseURL?: string
  model?: string
  timeoutMs?: number
}

type OpenAIChatCompletionResponse = {
  choices?: Array<{ message?: { content?: string } }>
}

const readSiliconFlowLocalConfig = (): SiliconFlowLocalConfigFile | null => {
  try {
    const filePath = join(process.cwd(), 'world.local.json')
    const raw = readFileSync(filePath, 'utf8')
    const parsed = JSON.parse(raw)
    if (!parsed || typeof parsed !== 'object') return null
    return parsed as SiliconFlowLocalConfigFile
  } catch {
    return null
  }
}

const extractJsonObject = (text: string): any => {
  const trimmed = text.trim()
  try {
    return JSON.parse(trimmed)
  } catch {}
  const m = trimmed.match(/\{[\s\S]*\}/)
  if (!m) return null
  try {
    return JSON.parse(m[0])
  } catch {
    return null
  }
}

const coerceChoices = (value: unknown): Choice[] =>
  Array.isArray(value)
    ? value
        .filter(v => v && typeof (v as any).id === 'string' && typeof (v as any).label === 'string')
        .map(v => ({ id: (v as any).id, label: (v as any).label }))
    : []

export const createSiliconFlowProvider = (cfg: SiliconFlowConfig): DirectorProvider => ({
  decide: async ({ prompt, input }: DirectorProviderRequest): Promise<DirectorResult> => {
    const controller = new AbortController()
    const t = setTimeout(() => controller.abort(), cfg.timeoutMs)
    try {
      const url = `${cfg.baseURL.replace(/\/+$/, '')}/chat/completions`
      const body = {
        model: cfg.model,
        messages: [
          { role: 'system', content: prompt.system },
          {
            role: 'user',
            content:
              `${prompt.user}\n\n` +
              `上下文（JSON）：\n${JSON.stringify(prompt.context)}\n\n` +
              `请严格只输出一个JSON对象，不要输出多余文本。`,
          },
        ],
        temperature: 0.2,
      }
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${cfg.apiKey}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
      })
      if (!res.ok) {
        const txt = await res.text().catch(() => '')
        return {
          message: '导演服务暂时不可用。',
          choices: [],
          logSummary: `director provider http ${res.status}${txt ? `: ${txt.slice(0, 120)}` : ''}`,
        }
      }
      const json = (await res.json()) as OpenAIChatCompletionResponse
      const content = json.choices?.[0]?.message?.content ?? ''
      const parsed = extractJsonObject(content)
      if (!parsed || typeof parsed !== 'object') {
        return {
          message: '导演服务返回了无法解析的结果。',
          choices: [],
          logSummary: 'director provider parse failed',
        }
      }
      return {
        message: typeof (parsed as any).message === 'string' ? (parsed as any).message : '',
        choices: coerceChoices((parsed as any).choices),
        statePatch: typeof (parsed as any).statePatch === 'object' ? (parsed as any).statePatch : undefined,
        logSummary: typeof (parsed as any).logSummary === 'string' ? (parsed as any).logSummary : undefined,
      }
    } catch {
      return {
        message: '导演服务暂时不可用。',
        choices: [],
        logSummary: 'director provider exception',
      }
    } finally {
      clearTimeout(t)
    }
  },
})

export const createStubDirectorProvider = (): DirectorProvider => ({
  decide: async ({ input }: DirectorProviderRequest): Promise<DirectorResult> => ({
    message: '导演服务未配置或不可用。本回合未生成新的推进结果。',
    choices: input.state.pendingChoices ?? [],
    logSummary: 'director stub fallback',
  }),
})

export const createDirectorProviderFromEnv = (): DirectorProvider => {
  const local = readSiliconFlowLocalConfig()
  const apiKey =
    (typeof local?.apiKey === 'string' ? local.apiKey.trim() : '') ||
    (process.env.SILICONFLOW_API_KEY?.trim() ?? '')
  const model =
    (typeof local?.model === 'string' ? local.model.trim() : '') ||
    (process.env.SILICONFLOW_MODEL?.trim() ?? '')
  const baseURL =
    (
      (typeof local?.baseURL === 'string' ? local.baseURL.trim() : '') ||
      (process.env.SILICONFLOW_BASE_URL?.trim() ?? '') ||
      'https://api.siliconflow.cn/v1'
    ).trim()
  const timeoutMs =
    typeof local?.timeoutMs === 'number' && Number.isFinite(local.timeoutMs)
      ? Math.max(1000, Math.trunc(local.timeoutMs))
      : (() => {
          const timeoutMsRaw = process.env.SILICONFLOW_TIMEOUT_MS?.trim() ?? ''
          return timeoutMsRaw ? Math.max(1000, Number(timeoutMsRaw) || 15000) : 15000
        })()
  if (!apiKey || !model) return createStubDirectorProvider()
  return createSiliconFlowProvider({ apiKey, model, baseURL, timeoutMs })
}
