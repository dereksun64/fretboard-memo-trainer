// Dev-only simulated mic for browser tests. Load the app with ?sim (for
// example http://localhost:5173/?sim#/basics) and getUserMedia returns a
// synthetic stream; window.__sim "plays" additive plucks into it, lined up
// with the run hooks the screens expose (__fmtRun, __fmtBasics).

import { expectedMidi, type NoteName, type StringNum } from '../music/notes'

interface RunHook {
  firstBeat: number
  spb: number
  steps: { note: NoteName; string: StringNum }[]
  now: () => number
}
interface BasicsHook {
  note: string
  started: boolean
  expected: number[]
  pos: number
}
type Hooks = { __fmtRun?: RunHook; __fmtBasics?: BasicsHook }

export function installSimMic() {
  const ctx = new AudioContext()
  const dest = ctx.createMediaStreamDestination()
  navigator.mediaDevices.getUserMedia = async () => {
    await ctx.resume()
    return dest.stream
  }
  const hooks = window as unknown as Hooks

  /** Harmonics 1-6 with a fast attack and a ~0.6 s decay, like a plucked string. */
  const pluckAt = (t: number, midi: number) => {
    const f0 = 440 * 2 ** ((midi - 69) / 12)
    for (let h = 1; h <= 6; h++) {
      const osc = ctx.createOscillator()
      osc.frequency.value = f0 * h
      const gain = ctx.createGain()
      gain.gain.setValueAtTime(0.0001, t)
      gain.gain.exponentialRampToValueAtTime(0.3 / h, t + 0.005)
      gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.6)
      osc.connect(gain).connect(dest)
      osc.start(t)
      osc.stop(t + 0.65)
    }
  }
  const windowStart = (): number => {
    try {
      return JSON.parse(localStorage.getItem('fmt.settings') ?? '{}').windowStart ?? 1
    } catch {
      return 1
    }
  }
  const text = (sel: string) => document.querySelector(sel)?.textContent ?? null

  const sim = {
    /** Pluck `midi` now. */
    pluck(midi: number) {
      void ctx.resume()
      pluckAt(ctx.currentTime + 0.05, midi)
      return midi
    },
    /** Basics: play the note it's waiting for, or `offset` semitones off it. */
    basics(offset = 0) {
      const b = hooks.__fmtBasics
      if (!b) throw new Error('not on Basics')
      return sim.pluck(b.expected[Math.min(b.pos, b.expected.length - 1)] + offset)
    },
    /**
     * Exercises: schedule the whole started run on its beats. `skip` beats are
     * left out (misses), `wrong` beats are a semitone sharp, `offsetMs` shifts
     * every note (negative = early).
     */
    playRun({ skip = [] as number[], wrong = [] as number[], offsetMs = 0 } = {}) {
      const r = hooks.__fmtRun
      if (!r) throw new Error('no run started')
      void ctx.resume()
      const shift = ctx.currentTime - r.now() + offsetMs / 1000
      r.steps.forEach((s, i) => {
        if (skip.includes(i)) return
        pluckAt(r.firstBeat + i * r.spb + shift, expectedMidi(s.note, s.string, windowStart()) + (wrong.includes(i) ? 1 : 0))
      })
      return r.steps.length
    },
    /** Seconds until the started run's last beat has been judged and its results show. */
    runEndsIn() {
      const r = hooks.__fmtRun
      return r ? r.firstBeat + r.steps.length * r.spb + 0.6 - r.now() : 0
    },
    /** What the run screen shows right now (DOM, so it works even when the pane is hidden). */
    state() {
      return {
        hash: location.hash,
        button: text('.start-stop'),
        slot: text('.judgment-slot'),
        note: document.querySelector('.target-note')?.firstChild?.textContent ?? null,
        string: text('.target-string'),
        progress: text('.combo-slot'),
        counts: text('.play-foot .counts'),
        overlay: text('.results.overlay'),
        basics: hooks.__fmtBasics ? { started: hooks.__fmtBasics.started, pos: hooks.__fmtBasics.pos } : null,
      }
    },
    wait: (ms: number) => new Promise((r) => setTimeout(r, ms)),
  }
  Object.assign(window, { __sim: sim })
}
