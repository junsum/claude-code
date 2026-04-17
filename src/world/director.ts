import type { DirectorInput, DirectorResult } from './directorSchema.js'
import type { DirectorProvider } from './directorProvider.js'
import { createDirectorProviderFromEnv } from './directorProvider.js'
import { buildDirectorPrompt } from './directorPrompt.js'

export type WorldDirector = {
  decide: (input: DirectorInput) => Promise<DirectorResult>
}

export const createDirector = (provider: DirectorProvider): WorldDirector => ({
  decide: async (input: DirectorInput): Promise<DirectorResult> => {
    const prompt = buildDirectorPrompt(input)
    return provider.decide({ input, prompt })
  },
})

export const createStubDirector = (): WorldDirector =>
  createDirector(createDirectorProviderFromEnv())
