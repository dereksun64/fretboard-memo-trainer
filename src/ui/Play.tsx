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
import { StartHint, StartStop } from './controls'
import { SelectionBox, Tag } from './decor'
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
  /** False while the run sits ready, waiting for Start. */
  started: boolean
  steps: Step[]
  beats: BeatTarget[]
  bpm: number
  spb: number
  firstBeat: number
  played: PlayedNote[]
}

let runIds = 0

/**
 * A run laid out but not started. Its clock stands at -LEAD, so the notes sit
 * where they will be the moment Start is pressed and nothing jumps.
 */
function readyRun(item: PoolItem, counts: boolean, bpm: number, windowStart: number): Run {
  const steps = runSteps(item)
  const spb = 60 / bpm
  const firstBeat = COUNT_IN * spb
  return {
    id: ++runIds,
    item,
    counts,
    started: false,
    steps,
    beats: beatTargets(steps, firstBeat, bpm, windowStart),
    bpm,
    spb,
    firstBeat,
    played: [],
  }
}

export function Play({ exercise, progress, windowStart, onRunFinished }: Props) {
  const info = EXERCISE_INFO[exercise]
  const [engine, setEngine] = useState<AudioEngine | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [diagram, setDiagram] = useState(true)

  /** The next run from the pool (or a replay once the pool is cleared), ready to start. */
  const nextRun = (): Run => {
    const queued = nextItem(progress, exercise)
    return readyRun(queued ?? drawPool(exercise, Math.random)[0], queued !== null, progress.level, windowStart)
  }
  const [run, setRun] = useState<Run>(nextRun)
  // Set once the run on screen has been recorded as cleared, so stopping or
  // restarting it can't record the same run twice.
  const [recorded, setRecorded] = useState(false)

  // Stop the metronome if we leave mid-run.
  useEffect(() => () => engine?.metronome.stop(), [engine])

  // Collect note events while a run is playing.
  useEffect(() => {
    if (!engine || !run.started) return
    return engine.onNote((ev) => run.played.push({ time: engine.corrected(ev), midi: ev.midi }))
  }, [engine, run])

  /** Start `r` now: count-in, then the run. Needs a user gesture (click or key). */
  const begin = async (r: Run) => {
    setError(null)
    try {
      const e = engine ?? (await getAudioEngine())
      setEngine(e)
      const t0 = e.ctx.currentTime + LEAD
      const firstBeat = t0 + COUNT_IN * r.spb
      e.metronome.start(r.bpm, { startTime: t0, beats: COUNT_IN + r.steps.length, accent: runAccents(COUNT_IN) })
      if (import.meta.env.DEV) {
        // Lets browser tests line simulated plucks up with the beats.
        Object.assign(window, { __fmtRun: { firstBeat, spb: r.spb, steps: r.steps, now: () => e.ctx.currentTime } })
      }
      setRecorded(false)
      setRun({ ...r, id: ++runIds, started: true, firstBeat, beats: beatTargets(r.steps, firstBeat, r.bpm, windowStart), played: [] })
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    }
  }

  /** The same run again, from the top. A run already recorded comes back as a replay. */
  const sameRun = () => readyRun(run.item, run.counts && !recorded, run.bpm, windowStart)
  const show = (r: Run) => {
    engine?.metronome.stop()
    setRecorded(false)
    setRun(r)
  }

  /** Space / the Start-Stop button. Stopping keeps you here with the run ready again. */
  const toggle = () => {
    if (!run.started) return void begin(run)
    show(recorded ? nextRun() : sameRun())
  }
  const restart = () => begin(sameRun())

  // Shortcuts call the latest handlers through refs so the listener stays put.
  const keys = useRef({ toggle, restart })
  keys.current = { toggle, restart }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.target instanceof HTMLInputElement) return
      if (e.metaKey || e.ctrlKey || e.altKey) return // leave Cmd+R (reload) and friends alone
      if (e.code === 'Space') {
        // Not a click on whatever button has focus, and not a page scroll.
        e.preventDefault()
        if (!e.repeat) keys.current.toggle()
        return
      }
      if (e.key === 'd' || e.key === 'D') setDiagram((d) => !d)
      if ((e.key === 'r' || e.key === 'R') && !e.repeat) keys.current.restart()
      if (e.key === 'Escape') navigate('/')
    }
    // A focused button would also act on Space's keyup.
    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space' && !(e.target instanceof HTMLInputElement)) e.preventDefault()
    }
    addEventListener('keydown', onKey)
    addEventListener('keyup', onKeyUp)
    return () => {
      removeEventListener('keydown', onKey)
      removeEventListener('keyup', onKeyUp)
    }
  }, [])

  const header = (
    <div className="play-head">
      <a href="#/" className="back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="label">Exercise {exerciseCode(exercise)}</span>
        <span className="back-name">{info.name}</span>
        <span className="label muted">Esc</span>
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

  return (
    <main className="page play">
      {header}
      {error && (
        <p role="alert" style={{ color: 'var(--wrong)', margin: 0 }}>
          {error}
        </p>
      )}
      <RunView
        key={run.id}
        run={run}
        engine={engine}
        diagram={diagram}
        windowStart={windowStart}
        onToggleDiagram={() => setDiagram((d) => !d)}
        onToggle={toggle}
        onFinished={(s) => {
          engine?.metronome.stop()
          // A failed run isn't recorded: the player either tries it again or
          // overrides the result with "I think I got it".
          if (s.cleared) setRecorded(true)
          if (run.counts && s.cleared) onRunFinished(true)
        }}
        onPass={() => {
          setRecorded(true)
          if (run.counts) onRunFinished(true)
        }}
        onNext={() => show(nextRun())}
        onTryAgain={() => show(sameRun())}
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
  /** Null until the first Start (the mic opens on that click). */
  engine: AudioEngine | null
  diagram: boolean
  windowStart: number
  onToggleDiagram: () => void
  /** Start, or stop and get the run ready again. */
  onToggle: () => void
  onFinished: (s: RunSummary) => void
  /** "I think I got it": count a run the mic judged as failed. */
  onPass: () => void
  onNext: () => void
  /** Get the same run ready again (from the mistakes popup). */
  onTryAgain: () => void
  /** Play the same run again from the top, right away (the abandoned attempt isn't recorded). */
  onRestart: () => void
  progressNote: string
}

function RunView({ run, engine, diagram, windowStart, onToggleDiagram, onToggle, onFinished, onPass, onNext, onTryAgain, onRestart, progressNote }: RunViewProps) {
  const finishedRef = useRef(false)
  const [summary, setSummary] = useState<RunSummary | null>(null)
  // Set when the player overrides a failed result with "I think I got it".
  const [passed, setPassed] = useState(false)
  const soundPlayed = useRef(false)
  // Draw on the clock you're hearing (not the one the audio thread is
  // rendering ahead), and keep animating after the run ends so the last notes
  // slide past and fade. A run that hasn't started stands still at -LEAD.
  const clock = useFrameValue(() => (engine && run.started ? engine.displayTime() : -LEAD), run.started)
  const now = run.started ? clock : -LEAD

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
      if (engine) playMissSound(engine.ctx)
    }
  })

  const next = results.findIndex((r) => r.judgment === 'pending')
  const lastIdx = next === -1 ? results.length - 1 : next - 1
  const last = lastIdx >= 0 && results[lastIdx].judgment !== 'pending' ? results[lastIdx] : null
  const countIn =
    run.started && now < run.firstBeat - run.spb / 2 ? Math.min(COUNT_IN, Math.ceil((run.firstBeat - now) / run.spb)) : 0
  const target = run.steps[next === -1 ? run.steps.length - 1 : next]
  const perRep = run.steps.length / REPS
  const beatNo = next === -1 ? run.steps.length : next + 1
  const rep = Math.min(REPS, Math.floor((beatNo - 1) / perRep) + 1)
  const heard = engine?.livePitch.midi ?? null
  const mistakes = summary ? summary.miss + summary.wrong : 0

  return (
    <>
      <div className="run-meta label muted">
        <span className="run-note">{progressNote}</span>
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
          </div>
        </div>
        <div className="feedback" aria-live="polite">
          <span className="judgment-slot">
            {!run.started && <StartHint />}
            {run.started && last && (
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
              <button type="button" className="btn primary" onClick={onTryAgain} autoFocus>
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
            ) : run.started ? (
              'Listening'
            ) : (
              'Ready'
            )}
          </span>
          <button type="button" className="btn" onClick={onRestart}>
            Restart <span className="label muted">R</span>
          </button>
          <button type="button" className="btn" aria-pressed={diagram} onClick={onToggleDiagram}>
            Diagram <span className="label muted">D</span>
          </button>
          <StartStop started={run.started} onToggle={onToggle} />
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
