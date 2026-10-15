import { describe, expect, it } from 'vitest'
import { runAccents } from './metronome'

describe('runAccents', () => {
  it('accents the first count-in click and the start of every 6-string pass', () => {
    const accent = runAccents(4)
    const accented = Array.from({ length: 4 + 36 }, (_, i) => i).filter(accent)
    // count-in click 1, then run beats 0, 6, 12, ... (offset by the 4-beat count-in)
    expect(accented).toEqual([0, 4, 10, 16, 22, 28, 34])
  })
})
