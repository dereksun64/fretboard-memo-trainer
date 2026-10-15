import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../audio/engine'
import { hitWindowMs, judgeBeats, type BeatTarget, type BeatResult, type PlayedNote } from '../engine/judge'
import { singleNoteRun, type Step } from '../engine/sequence'
import { NATURALS, expectedMidi, fretFor, midiToName, type Natural } from '../music/notes'
import { useFrame } from './useFrame'

const COUNT_IN = 4

interface Run {
  t0: number
  bpm: number
  windowStart: number
  steps: Step[]
  beats: BeatTarget[]
}

export function RunTest({ engine, bpm, onBusy }: { engine: AudioEngine; bpm: number; onBusy: () => void }) {
  const [note, setNote] = useState<Natural | 'random'>('random')
  const [reps, setReps] = useState(1)
  const [windowStart, setWindowStart] = useState(1)
  const [run, setRun] = useState<Run | null>(null)
  const played = useRef<PlayedNote[]>([])

  useEffect(
    () => engine.onNote((ev) => played.current.push({ time: engine.corrected(ev), midi: ev.midi })),
    [engine],
  )

  const start = () => {
    onBusy()
    played.current = []
    const chosen = note === 'random' ? NATURALS[Math.floor(Math.random() * NATURALS.length)] : note
    const steps = singleNoteRun(chosen, reps)
    const spb = 60 / bpm
    const t0 = engine.ctx.currentTime + 0.3
    const beats = steps.map((s, i) => ({
      time: t0 + (COUNT_IN + i) * spb,
      expectedMidi: expectedMidi(s.note, s.string, windowStart),
    }))
    engine.metronome.start(bpm, { startTime: t0, beats: COUNT_IN + steps.length })
    setRun({ t0, bpm, windowStart, steps, beats })
  }

  const stop = () => {
    engine.metronome.stop()
    setRun(null)
  }

  return (
    <section className="card wide">
      <h2>Run test</h2>
      <p className="muted small">
        An Exercise 1-style run: one note, strings 6→1→6, judged per beat against a ±
        {Math.round(hitWindowMs(bpm))} ms window at {bpm} BPM. The fret is shown here only to make
        testing easier.
      </p>
      <div className="row">
        <label>
          Note
          <select value={note} onChange={(e) => setNote(e.target.value as Natural | 'random')}>
            <option value="random">Random</option>
            {NATURALS.map((n) => (
              <option key={n}>{n}</option>
            ))}
          </select>
        </label>
        <label>
          Reps
          <select value={reps} onChange={(e) => setReps(Number(e.target.value))}>
            <option value={1}>1 (12 beats)</option>
            <option value={3}>3 (36 beats)</option>
          </select>
        </label>
        <label>
          Fret window
          <select value={windowStart} onChange={(e) => setWindowStart(Number(e.target.value))}>
            {Array.from({ length: 8 }, (_, i) => i + 1).map((w) => (
              <option key={w} value={w}>
                {w}–{w + 11}
              </option>
            ))}
          </select>
        </label>
        <button className="primary" onClick={start}>
          {run ? 'Restart' : 'Start run'}
        </button>
        {run && <button onClick={stop}>Stop</button>}
      </div>
      {run && <RunView engine={engine} run={run} played={played.current} />}
    </section>
  )
}

function RunView({ engine, run, played }: { engine: AudioEngine; run: Run; played: PlayedNote[] }) {
  useFrame()
  const now = engine.ctx.currentTime
  const spb = 60 / run.bpm
  const results = judgeBeats(run.beats, played, run.bpm, now)
  const firstBeat = run.beats[0].time
  const current = Math.round((now - firstBeat) / spb)
  const done = results.every((r) => r.judgment !== 'pending')

  const counts = { perfect: 0, good: 0, miss: 0, wrong: 0 }
  for (const r of results) if (r.judgment !== 'pending') counts[r.judgment]++
  const cleared = counts.miss === 0 && counts.wrong === 0

  const target = run.steps[Math.max(0, Math.min(current, run.steps.length - 1))]

  return (
    <div className="run">
      {!done && (
        <div className="big-label">
          {current < 0 ? (
            `Count-in ${Math.min(COUNT_IN, -current)}`
          ) : (
            <>
              {target.note} <span className="muted">on string {target.string}</span>{' '}
              <span className="muted small">(fret {fretFor(target.note, target.string, run.windowStart)})</span>
            </>
          )}
        </div>
      )}
      <div className="beats">
        {run.steps.map((s, i) => (
          <BeatCell key={i} step={s} result={results[i]} active={!done && i === current} />
        ))}
      </div>
      <div className="summary">
        {done && <strong className={cleared ? 'ok' : 'error'}>{cleared ? 'Cleared' : 'Failed'}</strong>}
        <span className="tag perfect">Perfect {counts.perfect}</span>
        <span className="tag good">Good {counts.good}</span>
        <span className="tag miss">Miss {counts.miss}</span>
        <span className="tag wrong">Wrong {counts.wrong}</span>
      </div>
    </div>
  )
}

function BeatCell({ step, result, active }: { step: Step; result: BeatResult; active: boolean }) {
  const title =
    result.playedMidi === undefined
      ? result.judgment
      : `${result.judgment}: played ${midiToName(result.playedMidi)}, ${result.offsetMs! > 0 ? '+' : ''}${result.offsetMs} ms`
  return (
    <div className={`beat ${result.judgment} ${active ? 'active' : ''}`} title={title}>
      <span className="small">S{step.string}</span>
      <span className="strong">{step.note}</span>
      <span className="mono tiny">
        {result.offsetMs !== undefined ? `${result.offsetMs > 0 ? '+' : ''}${result.offsetMs}` : ''}
      </span>
    </div>
  )
}
