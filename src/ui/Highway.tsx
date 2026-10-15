// Six-lane highway: one lane per string (string 1 on top, like tab), notes
// scroll right-to-left onto the hit line in time with the metronome.

import { useEffect, useRef, useState } from 'react'
import type { BeatResult, BeatTarget } from '../engine/judge'
import type { Step } from '../engine/sequence'
import { useStyle } from './decor'

const LANE_H = 52
const LABEL_W = 40
const HIT = 0.18 // hit line position as a fraction of the note area
const BEAT_FRAC = 0.095 // horizontal distance between beats, fraction of the note area

interface Props {
  steps: readonly Step[]
  beats: readonly BeatTarget[]
  results: readonly BeatResult[]
  /** Current time on the audio clock (seconds). */
  now: number
  spb: number
  /** Index of the note to play next (-1 before the first). */
  next: number
}

export function Highway({ steps, beats, results, now, spb, next }: Props) {
  const style = useStyle()
  const ref = useRef<HTMLDivElement>(null)
  const [width, setWidth] = useState(800)

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

  return (
    <div className="highway" ref={ref} aria-hidden="true">
      {[1, 2, 3, 4, 5, 6].map((s) => (
        <div key={s} className="lane" style={{ top: (s - 1) * LANE_H + LANE_H / 2 }}>
          <span className="lane-label label">S{s}</span>
          <span className="lane-string" style={{ height: 1 + (s - 1) * 0.35 }} />
        </div>
      ))}

      <span className="hit-line" style={{ left: hitX }} />
      {style === 'blueprint' && (
        <>
          <svg className="hit-arrow" width="14" height="10" viewBox="0 0 14 10" style={{ left: hitX - 7 }}>
            <path d="M1 9l6-8 6 8" fill="none" stroke="var(--accent)" strokeWidth="1.5" />
          </svg>
          <span className="hit-t display" style={{ left: hitX + 10 }}>
            T
          </span>
        </>
      )}
      {style === 'retro' && <span className="hit-ring" style={{ left: hitX - 9 }} />}

      {beats.map((b, i) => {
        const x = hitX + ((b.time - now) / spb) * beatPx
        if (x < -24 || x > width + 24) return null
        const r = results[i]?.judgment ?? 'pending'
        const judged = r !== 'pending'
        const cls = judged ? `note judged ${r}` : i === next ? 'note next' : 'note'
        return (
          <span
            key={i}
            className={cls}
            style={{ transform: `translate(${x}px, ${(steps[i].string - 1) * LANE_H + LANE_H / 2}px)` }}
          >
            {judged ? '' : steps[i].note}
          </span>
        )
      })}
    </div>
  )
}

export const HIGHWAY_HEIGHT = LANE_H * 6
