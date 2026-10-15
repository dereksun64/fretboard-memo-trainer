// Rhythm mode: a count-in, then one run with the metronome. The mic's note
// events are judged against the beats every frame; when the last beat is
// judged the run is recorded (if it counts) and the results show.

import { useEffect, useRef, useState } from 'react'
import { getAudioEngine } from '../app/audio'
import { navigate } from '../app/navigate'
import { useFrameValue } from '../app/useNow'
import type { AudioEngine } from '../audio/engine'
import { beatTargets, hitWindowMs, judgeBeats, summarize, type BeatTarget, type PlayedNote, type RunSummary } from '../engine/judge'
import { drawPool, type ExerciseId, type PoolItem } from '../engine/pools'
import { clearedCount, isUnlocked, nextItem, poolSize, type Progress } from '../engine/progress'
import { REPS, runSteps, type Step } from '../engine/sequence'
import { midiToName } from '../music/notes'
import { SelectionBox, Stripe, Tag } from './decor'
import { EXERCISE_INFO, exerciseCode } from './exercises'
import { FretDiagram } from './FretDiagram'
import { Highway } from './Highway'
import './play.css'

const COUNT_IN = 4
const LEAD = 0.4 // seconds between pressing start and the first click

interface Props {
  exercise: ExerciseId
  progress: Progress
  windowStart: number
  onRunFinished: (cleared: boolean) => void
}

interface Run {
  id: number
  item: PoolItem
  /** False for replays of an already-cleared exercise. */
  counts: boolean
  steps: Step[]
  beats: BeatTarget[]
  bpm: number
  spb: number
  firstBeat: number
  played: PlayedNote[]
}

let runIds = 0

export function Play({ exercise, progress, windowStart, onRunFinished }: Props) {
  const info = EXERCISE_INFO[exercise]
  const [engine, setEngine] = useState<AudioEngine | null>(null)
  const [run, setRun] = useState<Run | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [diagram, setDiagram] = useState(true)

  // Stop the metronome if we leave mid-run.
  useEffect(() => () => engine?.metronome.stop(), [engine])

  // Collect note events for the current run.
  useEffect(() => {
    if (!engine || !run) return
    return engine.onNote((ev) => run.played.push({ time: engine.corrected(ev), midi: ev.midi }))
  }, [engine, run])

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.key === 'd' || e.key === 'D') setDiagram((d) => !d)
      if (e.key === 'Escape') navigate('/')
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  const start = async () => {
    setError(null)
    try {
      const e = engine ?? (await getAudioEngine())
      setEngine(e)
      const queued = nextItem(progress, exercise)
      const item = queued ?? drawPool(exercise, Math.random)[0]
      const steps = runSteps(item)
      const bpm = progress.level
      const spb = 60 / bpm
      const t0 = e.ctx.currentTime + LEAD
      const firstBeat = t0 + COUNT_IN * spb
      e.metronome.start(bpm, { startTime: t0, beats: COUNT_IN + steps.length })
      if (import.meta.env.DEV) {
        // Lets browser tests line simulated plucks up with the beats.
        Object.assign(window, { __fmtRun: { firstBeat, spb, steps, now: () => e.ctx.currentTime } })
      }
      setRun({
        id: ++runIds,
        item,
        counts: queued !== null,
        steps,
        beats: beatTargets(steps, firstBeat, bpm, windowStart),
        bpm,
        spb,
        firstBeat,
        played: [],
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  const header = (
    <div className="play-head">
      <a href="#/" className="back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="label">Exercise {exerciseCode(exercise)}</span>
        <span className="back-name">{info.name}</span>
      </a>
      <span className="label muted">{progress.level} BPM</span>
    </div>
  )

  if (!isUnlocked(progress, exercise)) {
    return (
      <main className="page play">
        {header}
        <p>This exercise is locked. Clear the ones before it first.</p>
        <a className="btn" href="#/">
          Back to exercises
        </a>
      </main>
    )
  }

  if (!run || !engine) {
    const done = clearedCount(progress, exercise)
    const total = poolSize(progress, exercise)
    return (
      <main className="page play">
        {header}
        <section className="ready">
          <h1 className="display">{info.name}</h1>
          <p className="muted">{info.desc}</p>
          <p>
            {done < total
              ? `${done} of ${total} runs cleared at ${progress.level} BPM. Each run is ${REPS} repetitions; a miss or wrong note fails it.`
              : `All runs cleared at ${progress.level} BPM. Replays don't count toward your level.`}
          </p>
          <p className="muted" style={{ fontSize: 14 }}>
            Uses your microphone. Headphones help keep the metronome out of the mic. Press D to toggle the
            fretboard diagram, Esc to leave.
          </p>
          <div>
            <button type="button" className="btn primary" onClick={start}>
              Start
            </button>
          </div>
          {error && <p style={{ color: 'var(--wrong)' }}>Couldn't open the microphone: {error}</p>}
        </section>
        {diagram && <FretDiagram windowStart={windowStart} />}
      </main>
    )
  }

  return (
    <main className="page play">
      {header}
      <RunView
        key={run.id}
        run={run}
        engine={engine}
        diagram={diagram}
        windowStart={windowStart}
        onToggleDiagram={() => setDiagram((d) => !d)}
        onFinished={(s) => {
          engine.metronome.stop()
          if (run.counts) onRunFinished(s.cleared)
        }}
        onNext={start}
        progressNote={
          run.counts
            ? `${clearedCount(progress, exercise)} of ${poolSize(progress, exercise)} runs cleared at ${run.bpm} BPM.`
            : "Replay: doesn't count toward your level."
        }
      />
    </main>
  )
}

interface RunViewProps {
  run: Run
  engine: AudioEngine
  diagram: boolean
  windowStart: number
  onToggleDiagram: () => void
  onFinished: (s: RunSummary) => void
  onNext: () => void
  progressNote: string
}

function RunView({ run, engine, diagram, windowStart, onToggleDiagram, onFinished, onNext, progressNote }: RunViewProps) {
  const finishedRef = useRef(false)
  const [summary, setSummary] = useState<RunSummary | null>(null)
  const now = useFrameValue(() => engine.ctx.currentTime, summary === null)

  const results = judgeBeats(run.beats, run.played, run.bpm, now)
  const live = summarize(results)

  useEffect(() => {
    if (live.finished && !finishedRef.current) {
      finishedRef.current = true
      setSummary(live)
      onFinished(live)
    }
  })

  const next = results.findIndex((r) => r.judgment === 'pending')
  const lastIdx = next === -1 ? results.length - 1 : next - 1
  const last = lastIdx >= 0 ? results[lastIdx] : null
  const countIn = now < run.firstBeat - run.spb / 2 ? Math.min(COUNT_IN, Math.ceil((run.firstBeat - now) / run.spb)) : 0
  const target = run.steps[next === -1 ? run.steps.length - 1 : next]
  const perRep = run.steps.length / REPS
  const beatNo = next === -1 ? run.steps.length : next + 1
  const rep = Math.min(REPS, Math.floor((beatNo - 1) / perRep) + 1)
  const heard = engine.livePitch.midi

  return (
    <>
      <div className="run-meta label muted">
        <span>
          Run <span className="ink">{rep}</span>/{REPS}
        </span>
        <span>
          Beat <span className="ink">{String(beatNo).padStart(2, '0')}</span>/{run.steps.length}
        </span>
        <span>±{Math.round(hitWindowMs(run.bpm))} ms</span>
      </div>
      <div className="run-progress" role="progressbar" aria-label="Run progress" aria-valuemin={0} aria-valuemax={run.steps.length} aria-valuenow={beatNo}>
        <span style={{ width: `${(Math.max(0, beatNo - 1) / run.steps.length) * 100}%` }} />
      </div>

      <section className="target-row">
        <div className="target">
          <SelectionBox>
            <span className="target-note display">{countIn ? countIn : target.note}</span>
          </SelectionBox>
          <div className="target-side">
            <span className="target-string">{countIn ? 'Count-in' : `string ${target.string}`}</span>
            <Stripe width={96} />
          </div>
        </div>
        <div className="feedback" aria-live="polite">
          {last && last.judgment !== 'pending' && (
            <span className="judgment">
              <Tag>{last.judgment}</Tag>
              {last.offsetMs !== undefined && (
                <span className="mono muted">
                  {last.offsetMs > 0 ? '+' : ''}
                  {last.offsetMs} ms
                </span>
              )}
              {last.judgment === 'wrong' && last.playedMidi !== undefined && (
                <span className="muted">heard {midiToName(last.playedMidi)}</span>
              )}
            </span>
          )}
          <span className="muted">
            <span className="combo display">{live.combo}</span> in a row
          </span>
        </div>
      </section>

      <Highway steps={run.steps} beats={run.beats} results={results} now={now} spb={run.spb} next={next} />

      <section className="play-foot">
        <div className="counts">
          {(['perfect', 'good', 'miss', 'wrong'] as const).map((k) => (
            <span key={k} className="count">
              <span className={`dot ${k}`} />
              <span className="mono">{live[k]}</span>
              <span className="label muted">{k}</span>
            </span>
          ))}
        </div>
        <div className="foot-actions">
          <span className="listening label muted">
            <span className="dot perfect" />
            {heard !== null ? `Hearing ${midiToName(Math.round(heard))}` : 'Listening'}
          </span>
          <button type="button" className="btn" aria-pressed={diagram} onClick={onToggleDiagram}>
            Diagram <span className="label muted">D</span>
          </button>
          <a className="btn ghost" href="#/">
            Stop <span className="label muted">Esc</span>
          </a>
        </div>
      </section>

      {summary && (
        <section className="results" aria-live="assertive">
          <div className="results-main">
            <span className={`results-title display ${summary.cleared ? 'cleared' : 'failed'}`}>
              {summary.cleared ? 'Cleared' : 'Failed'}
            </span>
            <span className="muted">{progressNote}</span>
          </div>
          <dl className="results-stats">
            <div>
              <dt className="label muted">Accuracy</dt>
              <dd className="mono">{summary.accuracy}%</dd>
            </div>
            <div>
              <dt className="label muted">Max combo</dt>
              <dd className="mono">{summary.maxCombo}</dd>
            </div>
            <div>
              <dt className="label muted">Perfect / Good</dt>
              <dd className="mono">
                {summary.perfect} / {summary.good}
              </dd>
            </div>
            <div>
              <dt className="label muted">Miss / Wrong</dt>
              <dd className="mono">
                {summary.miss} / {summary.wrong}
              </dd>
            </div>
          </dl>
          <div className="results-actions">
            <button type="button" className="btn primary" onClick={onNext} autoFocus>
              Next run
            </button>
            <a className="btn" href="#/">
              Exercises
            </a>
          </div>
        </section>
      )}

      {diagram && <FretDiagram windowStart={windowStart} />}
    </>
  )
}
