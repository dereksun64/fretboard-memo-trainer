// The fretboard chart Thomas says you may look at while practicing.

import { OPEN_STRING_MIDI, STRING_NAME, STRINGS, type StringNum } from '../music/notes'
import { Stripe, useStyle } from './decor'

const NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B']
const MARKERS = new Set([3, 5, 7, 9, 12, 15, 17, 19])

export function FretDiagram({ windowStart }: { windowStart: number }) {
  const style = useStyle()
  const frets = Array.from({ length: 12 }, (_, i) => windowStart + i)
  const rows = [...STRINGS].reverse() as StringNum[] // string 1 on top
  const title = `Frets ${windowStart}–${windowStart + 11}`

  return (
    <figure className="diagram">
      <figcaption className="diagram-title label">
        {style === 'blueprint' ? <span className="tag">FIG.1 — {title}</span> : <span className="muted">{style === 'retro' ? `Fig. 01 · ${title}` : title}</span>}
        <Stripe width={72} />
      </figcaption>
      <div className="diagram-scroll">
        <table>
          <thead>
            <tr>
              <th scope="col">
                <span className="sr-only">String</span>
              </th>
              {frets.map((f) => (
                <th key={f} scope="col" className={`label ${MARKERS.has(f) ? 'marker' : ''}`}>
                  {String(f).padStart(2, '0')}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((s) => (
              <tr key={s}>
                <th scope="row" className="label muted string-name">
                  {STRING_NAME[s]}
                </th>
                {frets.map((f) => {
                  const name = NAMES[(OPEN_STRING_MIDI[s] + f) % 12]
                  const natural = name.length === 1
                  return (
                    <td key={f} className={natural ? 'natural display' : 'accidental label'}>
                      {name}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </figure>
  )
}
