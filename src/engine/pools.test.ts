import { describe, expect, it } from 'vitest'
import { NATURALS, pitchClass, type NoteName } from '../music/notes'
import { basicsQueue, drawPool, type PoolItem } from './pools'
import { seeded } from './rng'

const notesOf = (pool: PoolItem[]): NoteName[] =>
  pool.flatMap((i) => (i.kind === 'note' ? [i.note] : i.kind === 'pair' ? [i.up, i.down] : i.notes))

const NEVER = ['E#', 'Fb', 'B#', 'Cb']

describe('pools', () => {
  // Run every property over many seeds so random edge cases show up.
  const seeds = Array.from({ length: 200 }, (_, i) => i + 1)

  it('Basics: two shuffled rounds of the 7 naturals', () => {
    for (const seed of seeds) {
      const q = basicsQueue(seeded(seed))
      expect(q).toHaveLength(14)
      expect([...q.slice(0, 7)].sort()).toEqual([...NATURALS].sort())
      expect([...q.slice(7)].sort()).toEqual([...NATURALS].sort())
    }
  })

  it('Exercise 1: each natural exactly once', () => {
    for (const seed of seeds) {
      const notes = notesOf(drawPool(1, seeded(seed)))
      expect([...notes].sort()).toEqual([...NATURALS].sort())
    }
  })

  it('Exercise 2: 7 runs, all 5 accidental pitches, 2 repeats spelled the other way after the first', () => {
    for (const seed of seeds) {
      const notes = notesOf(drawPool(2, seeded(seed)))
      expect(notes).toHaveLength(7)
      expect(notes.every((n) => n.length === 2 && !NEVER.includes(n))).toBe(true)
      const pcs = notes.map(pitchClass)
      expect(new Set(pcs)).toEqual(new Set([1, 3, 6, 8, 10]))
      const repeated = [...new Set(pcs)].filter((pc) => pcs.filter((x) => x === pc).length === 2)
      expect(repeated).toHaveLength(2)
      for (const pc of repeated) {
        const [a, b] = notes.filter((n) => pitchClass(n) === pc)
        expect(a).not.toBe(b) // one sharp, one flat
      }
    }
  })

  it('Exercise 3: 6 pairs covering all 12 pitch classes once', () => {
    for (const seed of seeds) {
      const pool = drawPool(3, seeded(seed))
      expect(pool).toHaveLength(6)
      const pcs = notesOf(pool).map(pitchClass)
      expect([...pcs].sort((a, b) => a - b)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11])
      expect(notesOf(pool).some((n) => NEVER.includes(n))).toBe(false)
    }
  })

  it('Exercise 4: 5 sets, each an ordering of the 7 naturals', () => {
    for (const seed of seeds) {
      const pool = drawPool(4, seeded(seed))
      expect(pool).toHaveLength(5)
      for (const item of pool) {
        expect(item.kind).toBe('sequence')
        if (item.kind === 'sequence') expect([...item.notes].sort()).toEqual([...NATURALS].sort())
      }
    }
  })

  it('is reproducible with the same seed', () => {
    expect(drawPool(2, seeded(7))).toEqual(drawPool(2, seeded(7)))
  })
})
