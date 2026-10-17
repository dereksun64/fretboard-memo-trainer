import { describe, expect, it } from 'vitest'
import {
  canIncreaseBpm,
  clearedCount,
  currentExercise,
  exercisesCleared,
  increaseBpm,
  isUnlocked,
  levelBar,
  newProgress,
  basicsRunsLeft,
  nextBasicsNote,
  pickBasicsNote,
  nextItem,
  recordBasicsClear,
  recordRun,
  skipBasics,
  type Progress,
} from './progress'
import type { ExerciseId } from './pools'
import { seeded } from './rng'

function finishBasics(p: Progress): Progress {
  while (nextBasicsNote(p)) p = recordBasicsClear(p)
  return p
}

function clearExercise(p: Progress, ex: ExerciseId): Progress {
  while (nextItem(p, ex)) p = recordRun(p, ex, true)
  return p
}

describe('progress', () => {
  it('starts at 40 BPM with Basics, everything else locked', () => {
    const p = newProgress(seeded(1))
    expect(p.level).toBe(40)
    expect(nextBasicsNote(p)).not.toBeNull()
    expect(currentExercise(p)).toBeNull()
    for (const ex of [1, 2, 3, 4] as const) expect(isUnlocked(p, ex)).toBe(false)
  })

  it('picking a Basics note plays it next and keeps each note once', () => {
    let p = newProgress(seeded(5))
    const first = nextBasicsNote(p)!
    const other = (['C', 'D', 'E', 'F', 'G', 'A', 'B'] as const).find((n) => n !== first)!
    p = pickBasicsNote(p, other)
    expect(nextBasicsNote(p)).toBe(other)
    expect([...p.basics.queue].sort()).toEqual([...newProgress(seeded(5)).basics.queue].sort())
    expect(basicsRunsLeft(p, other)).toBe(1)
    p = recordBasicsClear(p)
    expect(basicsRunsLeft(p, other)).toBe(0)
    // nothing left of it: picking changes nothing
    expect(pickBasicsNote(p, other)).toBe(p)
  })

  it('Basics takes 7 cleared runs and unlocks Exercise 1 only', () => {
    let p = newProgress(seeded(1))
    for (let i = 0; i < 6; i++) p = recordBasicsClear(p)
    expect(isUnlocked(p, 1)).toBe(false)
    p = recordBasicsClear(p)
    expect(nextBasicsNote(p)).toBeNull()
    expect(isUnlocked(p, 1)).toBe(true)
    expect(isUnlocked(p, 2)).toBe(false)
    expect(currentExercise(p)).toBe(1)
  })

  it('skipping Basics unlocks Exercise 1', () => {
    const p = skipBasics(recordBasicsClear(newProgress(seeded(8))))
    expect(nextBasicsNote(p)).toBeNull()
    expect(isUnlocked(p, 1)).toBe(true)
    expect(skipBasics(p)).toBe(p)
  })

  it('unlocks exercises strictly in order', () => {
    let p = finishBasics(newProgress(seeded(2)))
    for (let i = 0; i < 6; i++) p = recordRun(p, 1, true)
    expect(clearedCount(p, 1)).toBe(6)
    expect(isUnlocked(p, 2)).toBe(false)
    expect(nextItem(p, 2)).toBeNull()
    expect(recordRun(p, 2, true)).toBe(p) // locked: no effect
    p = recordRun(p, 1, true)
    expect(isUnlocked(p, 2)).toBe(true)
    expect(currentExercise(p)).toBe(2)
  })

  it('moves a failed run to the back so the next attempt differs', () => {
    let p = finishBasics(newProgress(seeded(3)))
    const first = nextItem(p, 1)
    p = recordRun(p, 1, false)
    expect(clearedCount(p, 1)).toBe(0)
    expect(nextItem(p, 1)).not.toEqual(first)
    expect(p.exercises[1].at(-1)?.item).toEqual(first)
  })

  it('increases BPM only after all four exercises, then relocks with fresh pools', () => {
    let p = finishBasics(newProgress(seeded(4)))
    for (const ex of [1, 2, 3] as const) p = clearExercise(p, ex)
    expect(canIncreaseBpm(p)).toBe(false)
    expect(increaseBpm(p, 5, seeded(9))).toBe(p)
    p = clearExercise(p, 4)
    expect(exercisesCleared(p)).toBe(4)
    expect(canIncreaseBpm(p)).toBe(true)

    p = increaseBpm(p, 5, seeded(9))
    expect(p.level).toBe(45)
    expect(exercisesCleared(p)).toBe(0)
    expect(currentExercise(p)).toBe(1)
    expect(isUnlocked(p, 2)).toBe(false)
    expect(nextBasicsNote(p)).toBeNull() // Basics stays done
  })

  it('clamps the increase to 1-10', () => {
    const ready = (seed: number) => {
      let p = finishBasics(newProgress(seeded(seed)))
      for (const ex of [1, 2, 3, 4] as const) p = clearExercise(p, ex)
      return p
    }
    expect(increaseBpm(ready(5), 25, seeded(1)).level).toBe(50)
    expect(increaseBpm(ready(5), 0, seeded(1)).level).toBe(41)
  })

  it('describes the 40->80 bar and the rainbow past it', () => {
    expect(levelBar(40)).toEqual({ fill: 0, rainbow: 0, mastered: false })
    expect(levelBar(60).fill).toBe(0.5)
    expect(levelBar(80)).toEqual({ fill: 1, rainbow: 0, mastered: true })
    expect(levelBar(100)).toEqual({ fill: 1, rainbow: 0.5, mastered: true })
    expect(levelBar(200).rainbow).toBe(1)
  })
})
