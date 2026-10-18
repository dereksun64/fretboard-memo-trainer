// First-visit welcome: what the method promises and how it works, over the
// whole app until "Let's start". Seen once per browser (fmt.welcomed);
// Clear local data brings it back.

import { useEffect, useRef, useState } from 'react'
import { SelectionBox, Tag } from './decor'
import './welcome.css'

const KEY = 'fmt.welcomed'

function loadWelcomed(): boolean {
  try {
    return localStorage.getItem(KEY) === '1'
  } catch {
    return false
  }
}

/** Whether to show the welcome, and a way to dismiss it for good. */
export function useWelcome(): [boolean, () => void] {
  const [show, setShow] = useState(() => !loadWelcomed())
  const dismiss = () => {
    try {
      localStorage.setItem(KEY, '1')
    } catch {
      // storage unavailable: it just shows again next visit
    }
    setShow(false)
  }
  return [show, dismiss]
}

// Thomas's video on the method (Music Theory for Guitar, YouTube).
const VIDEO_URL = 'https://youtu.be/PJddQ6Q0UDo'
const VIDEO_THUMB = 'https://i.ytimg.com/vi/PJddQ6Q0UDo/hqdefault.jpg'
const VIDEO_TITLE = 'How To MEMORIZE Your Guitar FRETBOARD: The No-Nonsense Exercise That Actually Works'

const PROMISES = [
  ['The reliable way', 'Know where every note is, not just the patterns.'],
  ['Five minutes a day', 'Done in order. That’s all it takes.'],
  ['Nothing to memorize', 'Keep the diagram open. Keep going, even when nothing seems to stick.'],
  ['It works', 'Thomas says everyone who finished it in order learned the fretboard.'],
] as const

const STEPS = [
  ['Basics', 'One note on every string, at your own pace.'],
  ['Naturals', 'The same, at 40 BPM.'],
  ['Sharps & Flats', 'One fret up or down.'],
  ['Two Notes', 'One going up, one coming down.'],
  ['Random', 'All seven naturals, shuffled.'],
  ['Increase BPM', 'Clean at 80 BPM, and you know it.'],
] as const

export function Welcome({ onStart }: { onStart: () => void }) {
  const start = useRef<HTMLButtonElement>(null)

  useEffect(() => {
    // Focus the button for keyboard users, but open at the top of the page.
    start.current?.focus({ preventScroll: true })
    // The app underneath is inert, but its shortcuts listen on window (Space
    // would start a run). Stop keys from reaching them; default actions like
    // Tab and Enter on the button still work.
    const block = (e: KeyboardEvent) => e.stopPropagation()
    addEventListener('keydown', block, true)
    addEventListener('keyup', block, true)
    return () => {
      removeEventListener('keydown', block, true)
      removeEventListener('keyup', block, true)
    }
  }, [])

  return (
    <div className="welcome" role="dialog" aria-modal="true" aria-labelledby="welcome-title">
      <div className="welcome-card">
        <header className="welcome-head">
          <Tag>Welcome</Tag>
          <SelectionBox>
            <h1 id="welcome-title" className="display">
              Learn every note on the fretboard.
            </h1>
          </SelectionBox>
          <p className="welcome-lead">
            Thomas’s method from Music Theory for Guitar, with a metronome and a mic that checks every note.
          </p>
        </header>

        <a className="welcome-video" href={VIDEO_URL} target="_blank" rel="noopener noreferrer">
          <span className="welcome-thumb">
            <img src={VIDEO_THUMB} alt="" loading="lazy" referrerPolicy="no-referrer" />
            <svg className="welcome-play" width="48" height="48" viewBox="0 0 48 48" aria-hidden="true">
              <circle cx="24" cy="24" r="23" />
              <path d="M19 15l14 9-14 9z" />
            </svg>
          </span>
          <span className="welcome-video-text">
            <span className="label muted">Watch the method · YouTube ↗</span>
            <span className="welcome-video-title">{VIDEO_TITLE}</span>
          </span>
        </a>

        <ul className="welcome-promises">
          {PROMISES.map(([title, body]) => (
            <li key={title}>
              <h2>{title}</h2>
              <p>{body}</p>
            </li>
          ))}
        </ul>

        <section className="welcome-method" aria-labelledby="welcome-method-title">
          <h2 id="welcome-method-title" className="label">
            The method · in order, no rushing
          </h2>
          <ol>
            {STEPS.map(([name, desc]) => (
              <li key={name}>
                <span className="welcome-step">{name}</span>
                <span className="muted">{desc}</span>
              </li>
            ))}
          </ol>
        </section>

        <footer className="welcome-foot">
          <span className="muted">Uses your mic. Nothing is recorded or uploaded.</span>
          <button ref={start} type="button" className="btn primary welcome-start" onClick={onStart}>
            Let’s start
          </button>
        </footer>
      </div>
    </div>
  )
}
