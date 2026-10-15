// Six-lane highway: one lane per string (high e on top, like tab), notes
// scroll right-to-left onto the hit line in time with the metronome.
//
// Everything is derived from the audio clock each frame, so the animations
// need no state of their own:
// - an osu-style approach circle shrinks onto each note as its beat nears;
// - once past the hit line a note keeps sliding, takes its judgment colour
//   and fades out;
// - a played note sets off a short burst on the hit line.

import { useEffect, useRef, useState } from 'react'
import type { BeatResult, BeatTarget } from '../engine/judge'
import type { Step } from '../engine/sequence'
import { STRING_NAME, type StringNum } from '../music/notes'
import { useStyle } from './decor'

const LANE_H = 52
const LABEL_W = 40
const HIT = 0.18 // hit line position as a fraction of the note area
const BEAT_FRAC = 0.095 // horizontal distance between beats, fraction of the note area
const APPROACH_SCALE = 2.6 // approach circle size (x note) when it appears
const FADE_BEATS = 0.9 // how long a passed note takes to fade out
const BURST_S = 0.38 // hit effect duration
const LANES: StringNum[] = [1, 2, 3, 4, 5, 6]

const clamp01 = (v: number) => Math.min(1, Math.max(0, v))

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(
    () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches,
  )
  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-reduced-motion: reduce)')
    const on = () => setReduced(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])
  return reduced
}

/** A burst not tied to a beat result, e.g. a wrong note in Basics. */
export interface Flash {
  id: number
  string: StringNum
  judgment: 'perfect' | 'good' | 'wrong'
  /** performance.now() when it happened. */
  at: number
}

interface Props {
  steps: readonly Step[]
  beats: readonly BeatTarget[]
  results: readonly BeatResult[]
  /** Current time on the audio clock (seconds), latency-corrected like the beats. */
  now: number
  spb: number
  /** Index of the note to play next (-1 once every beat is judged). */
  next: number
  /** osu-style approach circles; off for untimed play. */
  approachCircles?: boolean
  flashes?: readonly Flash[]
}

export function Highway({ steps, beats, results, now, spb, next, approachCircles = true, flashes = [] }: Props) {
  const style = useStyle()
  const reduced = useReducedMotion()
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)
  // When each beat's judgment first showed up (wall clock). Bursts are timed
  // from that moment rather than from the pluck, because note detection lags
  // the pluck by ~0.1 s and the burst would otherwise start half-finished.
  // Wall-clock time also works for untimed play, where `now` isn't seconds.
  const wall = performance.now()
  const judgedAt = useRef(new Map<number, number>())
  results.forEach((r, i) => {
    if (r.judgment === 'pending') judgedAt.current.delete(i) // e.g. a Basics restart
    else if (!judgedAt.current.has(i)) judgedAt.current.set(i, wall)
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const ro = new ResizeObserver(([e]) => setWidth(e.contentRect.width))
    ro.observe(el)
    return () => ro.disconnect()
  }, [])

  const area = Math.max(1, width - LABEL_W)
  const hitX = LABEL_W + area * HIT
  const beatPx = area * BEAT_FRAC
  // Approach circles appear ~1.6 beats out, but never shorter than 0.45 s
  // or longer than 1.2 s, like osu's approach rate.
  const approachS = Math.min(1.2, Math.max(0.45, 1.6 * spb))
  const laneY = (s: StringNum) => (s - 1) * LANE_H + LANE_H / 2

  const burst = (key: string, string: StringNum, judgment: string, at: number) => {
    const age = (wall - at) / 1000
    if (age < 0 || age > BURST_S) return null
    const t = age / BURST_S
    return (
      <span
        key={key}
        className={`burst ${judgment}`}
        style={{
          transform: `translate(${hitX}px, ${laneY(string)}px) scale(${reduced ? 1 : 1 + t * 0.9})`,
          opacity: 1 - t,
        }}
      >
        {style === 'blueprint' && (
          <>
            <span className="tick tl" />
            <span className="tick tr" />
            <span className="tick bl" />
            <span className="tick br" />
          </>
        )}
      </span>
    )
  }

  return (
    <div className="highway" ref={ref} aria-hidden="true">
      {LANES.map((s) => (
        <div key={s} className="lane" style={{ top: laneY(s) }}>
          <span className="lane-label label string-name">{STRING_NAME[s]}</span>
          <span className="lane-string" style={{ height: 1 + (s - 1) * 0.35 }} />
        </div>
      ))}

      <span className="hit-line" style={{ left: hitX }} />
      {style === 'blueprint' && (
        <svg className="hit-arrow" width="14" height="10" viewBox="0 0 14 10" style={{ left: hitX - 7 }}>
          <path d="M1 9l6-8 6 8" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
        </svg>
      )}
      {style === 'retro' && <span className="hit-ring" style={{ left: hitX - 9 }} />}

      {beats.map((b, i) => {
        const dt = b.time - now
        const x = hitX + (dt / spb) * beatPx
        if (x < -40 || x > width + 40) return null
        const judgment = results[i]?.judgment ?? 'pending'
        const past = dt < 0
        const fade = past ? clamp01(1 + dt / (FADE_BEATS * spb)) : 1
        if (fade <= 0) return null
        const shrink = reduced ? 1 : 0.8 + 0.2 * fade

        let cls = 'note'
        if (judgment !== 'pending') cls += ` past ${judgment}`
        else if (i === next) cls += ' next'

        const showApproach = approachCircles && !reduced && judgment === 'pending' && dt > 0 && dt <= approachS
        const approach = showApproach ? 1 - dt / approachS : 0 // 0 when it appears, 1 on the beat

        return (
          <span
            key={i}
            className={cls}
            style={{
              transform: `translate(${x}px, ${laneY(steps[i].string)}px) scale(${shrink})`,
              opacity: fade,
            }}
          >
            {steps[i].note}
            {showApproach && (
              <span
                className="approach"
                style={{
                  transform: `scale(${APPROACH_SCALE - (APPROACH_SCALE - 1) * approach})`,
                  opacity: Math.min(1, approach * 2.2),
                }}
              />
            )}
          </span>
        )
      })}

      {results.map((r, i) =>
        r.judgment === 'perfect' || r.judgment === 'good' || r.judgment === 'wrong'
          ? burst(`b${i}`, steps[i].string, r.judgment, judgedAt.current.get(i) ?? wall)
          : null,
      )}
      {flashes.map((f) => burst(`f${f.id}`, f.string, f.judgment, f.at))}
    </div>
  )
}
