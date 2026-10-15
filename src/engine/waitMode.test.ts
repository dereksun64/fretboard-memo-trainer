import { describe, expect, it } from 'vitest'
import { feedWait, startWait } from './waitMode'

describe('wait mode', () => {
  const expected = [45, 57, 57]

  it('advances on correct notes and finishes', () => {
    let s = startWait()
    let r = feedWait(s, expected, 45)
    expect(r.outcome).toBe('hit')
    s = r.state
    s = feedWait(s, expected, 57).state
    r = feedWait(s, expected, 57)
    expect(r.outcome).toBe('done')
    expect(r.state.done).toBe(true)
  })

  it('restarts the run on a wrong note, octave included', () => {
    let s = feedWait(startWait(), expected, 45).state
    const r = feedWait(s, expected, 45) // right letter, wrong octave
    expect(r.outcome).toBe('wrong')
    expect(r.state.pos).toBe(0)
    expect(r.state.restarts).toBe(1)
    s = r.state
    expect(feedWait(s, expected, 45).outcome).toBe('hit')
  })
})
