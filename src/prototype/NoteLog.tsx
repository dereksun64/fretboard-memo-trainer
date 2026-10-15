import { useEffect, useRef, useState } from 'react'
import type { AudioEngine } from '../audio/engine'
import { hitWindowMs, perfectWindowMs } from '../engine/judge'
import { midiToName } from '../music/notes'

interface Row {
  id: number
  name: string
  cents: number
  agreement: number
  offsetMs: number | null
  timing: 'perfect' | 'good' | 'off' | null
}

const MAX_ROWS = 25

export function NoteLog({ engine, bpm }: { engine: AudioEngine; bpm: number }) {
  const [rows, setRows] = useState<Row[]>([])
  const nextId = useRef(0)

  useEffect(() => {
    return engine.onNote((ev) => {
      const m = engine.metronome
      let offsetMs: number | null = null
      let timing: Row['timing'] = null
      if (m.running) {
        const t = engine.corrected(ev)
        offsetMs = Math.round((t - m.beatTime(m.nearestBeat(t))) * 1000)
        const abs = Math.abs(offsetMs)
        timing = abs <= perfectWindowMs(bpm) ? 'perfect' : abs <= hitWindowMs(bpm) ? 'good' : 'off'
      }
      const row: Row = {
        id: nextId.current++,
        name: midiToName(ev.midi),
        cents: ev.cents,
        agreement: ev.agreement,
        offsetMs,
        timing,
      }
      setRows((r) => [row, ...r].slice(0, MAX_ROWS))
    })
  }, [engine, bpm])

  return (
    <section className="card log">
      <div className="row spread">
        <h2>Detected notes</h2>
        <button onClick={() => setRows([])}>Clear</button>
      </div>
      <p className="muted small">
        Every note onset the detector picks up. With the metronome on, timing is shown against the
        nearest click (latency-corrected).
      </p>
      <table>
        <thead>
          <tr>
            <th>Note</th>
            <th>Cents</th>
            <th>Agree</th>
            <th>Offset</th>
            <th>Timing</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.id}>
              <td className="mono strong">{r.name}</td>
              <td className="mono">{r.cents > 0 ? `+${r.cents}` : r.cents}</td>
              <td className="mono">{Math.round(r.agreement * 100)}%</td>
              <td className="mono">
                {r.offsetMs === null ? '–' : `${r.offsetMs > 0 ? '+' : ''}${r.offsetMs} ms`}
              </td>
              <td>{r.timing && <span className={`tag ${r.timing}`}>{r.timing}</span>}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {rows.length === 0 && <p className="muted center">Pluck a note…</p>}
    </section>
  )
}
