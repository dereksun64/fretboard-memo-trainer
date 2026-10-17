import { describe, expect, it } from 'vitest'
import { newProgress, recordBasicsClear } from './progress'
import { seeded } from './rng'
import { clearLocalData, loadProgress, saveProgress } from './storage'

function memoryStorage(): Storage {
  const data = new Map<string, string>()
  return {
    get length() {
      return data.size
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, v),
  }
}

describe('storage', () => {
  it('clears only this app\'s keys', () => {
    const s = memoryStorage()
    saveProgress(newProgress(seeded(1)), s)
    s.setItem('fmt.settings', '{}')
    s.setItem('fmt.latencyMs', '40')
    s.setItem('other.app', 'keep')
    clearLocalData(s)
    expect(s.length).toBe(1)
    expect(s.getItem('other.app')).toBe('keep')
  })

  it('round-trips progress', () => {
    const s = memoryStorage()
    const p = recordBasicsClear(newProgress(seeded(1)))
    saveProgress(p, s)
    expect(loadProgress(seeded(2), s)).toEqual(p)
  })

  it('starts fresh when nothing is saved, the value is corrupt, or storage throws', () => {
    const fresh = newProgress(seeded(3))
    expect(loadProgress(seeded(3), memoryStorage())).toEqual(fresh)

    const corrupt = memoryStorage()
    corrupt.setItem('fmt.progress', '{"version":1,"level":"x"')
    expect(loadProgress(seeded(3), corrupt)).toEqual(fresh)

    const broken = { ...memoryStorage(), getItem: () => { throw new Error('blocked') } } as Storage
    expect(loadProgress(seeded(3), broken)).toEqual(fresh)
    expect(() => saveProgress(fresh, { ...broken, setItem: () => { throw new Error('full') } } as Storage)).not.toThrow()
  })
})
