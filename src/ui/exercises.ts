import type { ExerciseId } from '../engine/pools'

export const EXERCISE_INFO: Record<ExerciseId, { name: string; desc: string }> = {
  1: { name: 'Naturals', desc: 'One note across all six strings, up and back.' },
  2: { name: 'Sharps & Flats', desc: 'The same drill with accidentals, named either way.' },
  3: { name: 'Two Notes', desc: 'One note going up, a second coming back down.' },
  4: { name: 'Random', desc: 'All seven naturals in a shuffled order.' },
}

export const exerciseCode = (ex: number) => String(ex).padStart(2, '0')
