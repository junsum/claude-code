import fs from 'node:fs/promises'
import path from 'node:path'
import type { EventRecord, WorldState } from './types.js'

const getPaths = () => {
  const cwd = process.cwd()
  const statePath = path.join(cwd, 'world-state.json')
  const eventsPath = path.join(cwd, 'world-events.jsonl')
  return { statePath, eventsPath }
}

export const loadState = async (): Promise<WorldState | null> => {
  const { statePath } = getPaths()
  try {
    const buf = await fs.readFile(statePath, 'utf8')
    return JSON.parse(buf) as WorldState
  } catch {
    return null
  }
}

export const saveState = async (state: WorldState): Promise<void> => {
  const { statePath } = getPaths()
  const data = JSON.stringify(state, null, 2)
  await fs.writeFile(statePath, data, 'utf8')
}

export const appendEvent = async (rec: EventRecord): Promise<void> => {
  const { eventsPath } = getPaths()
  const line = JSON.stringify(rec) + '\n'
  await fs.appendFile(eventsPath, line, 'utf8').catch(async err => {
    if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
      await fs.writeFile(eventsPath, line, 'utf8')
      return
    }
    throw err
  })
}

