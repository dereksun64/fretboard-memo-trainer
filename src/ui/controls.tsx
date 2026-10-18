// Run-screen controls shared by Basics and the exercises.

import { useEffect, useState } from 'react'
import { useFrameValue } from '../app/useNow'
import type { AudioEngine } from '../audio/engine'
import { midiToName } from '../music/notes'
import { FretDiagram } from './FretDiagram'

/** Start / Stop in one fixed-width button, on Space. */
export function StartStop({ started, onToggle }: { started: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`btn start-stop ${started ? '' : 'primary'}`} onClick={onToggle}>
      {started ? 'Stop' : 'Start'} <span className="label muted">Space</span>
    </button>
  )
}

// Page-wide (not saved): has a run been started yet this visit? Until then
// the start hint shows whenever a run is ready; after that it only comes
// back when the page has been idle for IDLE_MS.
let hintSeen = false
const IDLE_MS = 3000
const ACTIVITY = ['pointerdown', 'pointermove', 'keydown', 'wheel', 'touchstart'] as const

/** True once there has been no pointer, key or touch input for `ms`. */
function useIdle(ms: number): boolean {
  const [idle, setIdle] = useState(false)
  useEffect(() => {
    let timer = setTimeout(() => setIdle(true), ms)
    const wake = () => {
      setIdle(false)
      clearTimeout(timer)
      timer = setTimeout(() => setIdle(true), ms)
    }
    for (const e of ACTIVITY) addEventListener(e, wake, { passive: true })
    return () => {
      clearTimeout(timer)
      for (const e of ACTIVITY) removeEventListener(e, wake)
    }
  }, [ms])
  return idle
}

/**
 * "Press Space to start", pulsing gently, in the footer between the counts
 * and the buttons. Shown while a run is ready, until the first run of the
 * visit starts; after that only once the page has been idle for 3 s. When
 * hidden it keeps its space, so nothing in the footer moves.
 */
export function StartHint({ started }: { started: boolean }) {
  const idle = useIdle(IDLE_MS)
  useEffect(() => {
    if (started) hintSeen = true
  }, [started])
  const show = !started && (!hintSeen || idle)
  return (
    <span className="foot-hint" aria-hidden={!show}>
      <span className={`start-hint ${show ? '' : 'is-hidden'}`}>
        Press <kbd>Space</kbd> to start
      </span>
    </span>
  )
}

/**
 * Ready / Listening / Hearing C3, under the BPM in the header. It re-renders
 * itself every frame while a run plays, so the header doesn't have to.
 */
export function ListenStatus({ engine, started }: { engine: AudioEngine | null; started: boolean }) {
  const heard = useFrameValue(() => engine?.livePitch.midi ?? null, started)
  return (
    <span className="listening label muted">
      <span className={`dot ${started ? 'perfect' : 'idle'}`} />
      {!started ? (
        'Ready'
      ) : heard !== null ? (
        <>
          Hearing <span className="mono">{midiToName(Math.round(heard))}</span>
        </>
      ) : (
        'Listening'
      )}
    </span>
  )
}

/**
 * The fretboard diagram behind a disclosure row under the counts: the arrow
 * turns and the chart slides open or shut (also on D).
 */
export function DiagramSection({ open, onToggle, windowStart }: { open: boolean; onToggle: () => void; windowStart: number }) {
  return (
    <section className="diagram-section">
      <button type="button" className="diagram-toggle" aria-expanded={open} aria-controls="fret-diagram" onClick={onToggle}>
        <svg className="diagram-arrow" width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
          <path d="M4 2l4 4-4 4" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="square" />
        </svg>
        Diagram <span className="label muted">D</span>
      </button>
      <div id="fret-diagram" className="collapse" data-open={open} inert={!open}>
        <div className="collapse-inner">
          <FretDiagram windowStart={windowStart} />
        </div>
      </div>
    </section>
  )
}
