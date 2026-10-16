// Rhythm mode: a count-in, then one run with the metronome. The mic's note
// events are judged against the beats every frame and the run always plays
// to the end. A clean run is recorded and the results show; with mistakes,
// the player can try again or count it anyway (the mic can mishear).

import { useEffect, useRef, useState } from 'react'
import { getAudioEngine } from '../app/audio'
import { navigate } from '../app/navigate'
import { useFrameValue } from '../app/useNow'
import type { AudioEngine } from '../audio/engine'
import { runAccents } from '../audio/metronome'
import { playMissSound } from '../audio/sfx'
import { beatTargets, hitWindowMs, judgeBeats, summarize, type BeatTarget, type PlayedNote, type RunSummary } from '../engine/judge'
import { drawPool, type ExerciseId, type PoolItem } from '../engine/pools'
import { clearedCount, isUnlocked, nextItem, poolSize, type Progress } from '../engine/progress'
import { REPS, runSteps, type Step } from '../engine/sequence'
import { midiToName, stringLabel } from '../music/notes'
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

  // R restarts whatever run is on screen; kept in a ref so the key handler stays put.
  const restartRef = useRef<(() => void) | null>(null)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return // leave Cmd+R (reload) and friends alone
      if (e.key === 'd' || e.key === 'D') setDiagram((d) => !d)
      if ((e.key === 'r' || e.key === 'R') && !e.repeat) restartRef.current?.()
      if (e.key === 'Escape') navigate('/')
    }
    addEventListener('keydown', onKey)
    return () => removeEventListener('keydown', onKey)
  }, [])

  /** Start a run: the next one from the pool, or `retry` to play the same run again. */
  const beginRun = async (retry?: { item: PoolItem; counts: boolean }) => {
    setError(null)
    try {
      const e = engine ?? (await getAudioEngine())
      setEngine(e)
      const queued = retry ? (retry.counts ? retry.item : null) : nextItem(progress, exercise)
      const item = retry?.item ?? queued ?? drawPool(exercise, Math.random)[0]
      const steps = runSteps(item)
      const bpm = progress.level
      const spb = 60 / bpm
      const t0 = e.ctx.currentTime + LEAD
      const firstBeat = t0 + COUNT_IN * spb
      e.metronome.start(bpm, { startTime: t0, beats: COUNT_IN + steps.length, accent: runAccents(COUNT_IN) })
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
  const start = () => beginRun()
  const restart = () => run && beginRun({ item: run.item, counts: run.counts })
  restartRef.current = run && engine ? restart : null

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
              ? `${done} of ${total} runs cleared at ${progress.level} BPM. Each run is ${REPS} repetitions, played through to the end.`
              : `All runs cleared at ${progress.level} BPM. Replays don't count toward your level.`}
          </p>
          <p className="muted" style={{ fontSize: 14 }}>
            Uses your microphone. Headphones help keep the metronome out of the mic. Press D to toggle the
            fretboard diagram, R to restart a run, Esc to leave.
          </p>
          <div>
            <button type="button" className="btn primary" onClick={start}>
              Start
            </button>
          </div>
          {error && (
            <p role="alert" style={{ color: 'var(--wrong)' }}>
              {error}
            </p>
          )}
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
          // A failed run isn't recorded: the player either tries it again or
          // overrides the result with "I think I got it".
          if (run.counts && s.cleared) onRunFinished(true)
        }}
        onPass={() => {
          if (run.counts) onRunFinished(true)
        }}
        onNext={start}
        onRestart={restart}
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
  /** "I think I got it": count a run the mic judged as failed. */
  onPass: () => void
  onNext: () => void
  /** Play the same run again from the top (the abandoned attempt isn't recorded). */
  onRestart: () => void
  progressNote: string
}

function RunView({ run, engine, diagram, windowStart, onToggleDiagram, onFinished, onPass, onNext, onRestart, progressNote }: RunViewProps) {
  const finishedRef = useRef(false)
  const [summary, setSummary] = useState<RunSummary | null>(null)
  // Set when the player overrides a failed result with "I think I got it".
  const [passed, setPassed] = useState(false)
  const soundPlayed = useRef(false)
  // Draw on the clock you're hearing (not the one the audio thread is
  // rendering ahead), and keep animating after the run ends so the last notes
  // slide past and fade.
  const now = useFrameValue(() => engine.displayTime())

  const { beats } = run
  const results = judgeBeats(beats, run.played, run.bpm, now)
  const live = summarize(results)
  // Results wait until the last note has slid past the hit line and faded.
  const lastBeat = beats[beats.length - 1].time
  const showResults = summary !== null && now > lastBeat + run.spb + 0.15

  useEffect(() => {
    if (live.finished && !finishedRef.current) {
      finishedRef.current = true
      setSummary(live)
      onFinished(live)
    }
    // A soft error sound as the "made a few mistakes" popup appears.
    if (showResults && summary && !summary.cleared && !soundPlayed.current) {
      soundPlayed.current = true
      playMissSound(engine.ctx)
    }
  })

  const next = results.findIndex((r) => r.judgment === 'pending')
  const lastIdx = next === -1 ? results.length - 1 : next - 1
  const last = lastIdx >= 0 && results[lastIdx].judgment !== 'pending' ? results[lastIdx] : null
  const countIn =
    now < run.firstBeat - run.spb / 2 ? Math.min(COUNT_IN, Math.ceil((run.firstBeat - now) / run.spb)) : 0
  const target = run.steps[next === -1 ? run.steps.length - 1 : next]
  const perRep = run.steps.length / REPS
  const beatNo = next === -1 ? run.steps.length : next + 1
  const rep = Math.min(REPS, Math.floor((beatNo - 1) / perRep) + 1)
  const heard = engine.livePitch.midi
  const mistakes = summary ? summary.miss + summary.wrong : 0

  return (
    <>
      <div className="run-meta label muted">
        <span>
          Run <span className="ink mono">{rep}</span>/{REPS}
        </span>
        <span>
          Beat <span className="ink mono">{String(beatNo).padStart(2, '0')}</span>/{run.steps.length}
        </span>
        <span>
          ±<span className="mono">{Math.round(hitWindowMs(run.bpm))}</span> ms
        </span>
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
            <span className="target-string">{countIn ? 'Count-in' : `${stringLabel(target.string)} string`}</span>
            <Stripe width={96} />
          </div>
        </div>
        <div className="feedback" aria-live="polite">
          <span className="judgment-slot">
            {last && (
              <>
                <Tag>{last.judgment}</Tag>
                <span className="offset mono muted">
                  {last.judgment === 'wrong' && last.playedMidi !== undefined
                    ? midiToName(last.playedMidi)
                    : last.offsetMs !== undefined
                      ? `${last.offsetMs > 0 ? '+' : last.offsetMs < 0 ? '−' : ''}${Math.abs(last.offsetMs)} ms`
                      : ''}
                </span>
              </>
            )}
          </span>
          <span className="combo-slot muted">
            <span className="combo display">{live.combo}</span> in a row
          </span>
        </div>
      </section>

      <div className="stage">
        <Highway steps={run.steps} beats={beats} results={results} now={now} spb={run.spb} next={next} />
        {showResults && summary && !summary.cleared && !passed && (
          <section className="results overlay miss-prompt" role="alertdialog" aria-labelledby="miss-title" aria-describedby="miss-desc">
            <div className="results-main">
              <span id="miss-title" className="results-title display failed">
                {mistakes === 1 ? 'A mistake?' : 'A few mistakes?'}
              </span>
              <span id="miss-desc" className="muted">
                We think you made {mistakes === 1 ? 'a mistake' : 'a few mistakes'} ({mistakeList(summary)}). Try again? If the
                mic misheard you, count it.
              </span>
            </div>
            <Stats summary={summary} />
            <div className="results-actions">
              <button type="button" className="btn primary" onClick={onRestart} autoFocus>
                Try again
              </button>
              <button
                type="button"
                className="btn"
                onClick={() => {
                  setPassed(true)
                  onPass()
                }}
              >
                I think I got it
              </button>
            </div>
            <a className="overlay-foot muted" href="#/lab">
              Calibrate in lab →
            </a>
          </section>
        )}
        {showResults && summary && (summary.cleared || passed) && (
          <section className="results overlay" aria-live="assertive">
            <div className="results-main">
              <span className="results-title display cleared">Cleared</span>
              <span className="muted">{passed ? `Counted as cleared. ${progressNote}` : progressNote}</span>
            </div>
            <Stats summary={summary} />
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
      </div>

      <section className="play-foot">
        <div className="counts">
          {(['perfect', 'good', 'miss', 'wrong'] as const).map((k) => (
            <span key={k} className="count">
              <span className={`dot ${k}`} />
              <span className="count-num mono">{live[k]}</span>
              <span className="label muted">{k}</span>
            </span>
          ))}
        </div>
        <div className="foot-actions">
          <span className="listening label muted">
            <span className="dot perfect" />
            {heard !== null ? (
              <>
                Hearing <span className="mono">{midiToName(Math.round(heard))}</span>
              </>
            ) : (
              'Listening'
            )}
          </span>
          <button type="button" className="btn" onClick={onRestart}>
            Restart <span className="label muted">R</span>
          </button>
          <button type="button" className="btn" aria-pressed={diagram} onClick={onToggleDiagram}>
            Diagram <span className="label muted">D</span>
          </button>
          <a className="btn ghost" href="#/">
            Stop <span className="label muted">Esc</span>
          </a>
        </div>
      </section>

      {diagram && <FretDiagram windowStart={windowStart} />}
    </>
  )
}

function mistakeList(s: RunSummary): string {
  const parts = []
  if (s.miss) parts.push(`${s.miss} missed`)
  if (s.wrong) parts.push(`${s.wrong} wrong`)
  return parts.join(', ')
}

function Stats({ summary }: { summary: RunSummary }) {
  return (
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
  )
}
