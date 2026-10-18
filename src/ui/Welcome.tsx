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

const PROMISES = [
  {
    title: 'The reliable way',
    body: 'Finding notes is the slowest part of playing for most guitarists, and patterns alone don’t fix it. You have to actually know where each note is. There’s no shortcut, but there is a method that works.',
  },
  {
    title: 'Five minutes a day',
    body: 'It isn’t hard. A short session every day, done strictly in order, is all it takes.',
  },
  {
    title: 'Nothing to memorize',
    body: 'Keep the fretboard diagram open the whole time. It’s normal to feel like nothing is sticking. Keep going, and it works.',
  },
  {
    title: 'It works for everyone who finishes',
    body: 'Thomas says everyone who did all the exercises in order learned the fretboard, without exception.',
  },
]

const STEPS = [
  ['Basics', 'One note on every string, low to high and back, at your own pace.'],
  ['Exercise 1 · Naturals', 'The same, now with a metronome at 40 BPM. That small bit of time pressure is what makes it stick.'],
  ['Exercise 2 · Sharps & Flats', 'One fret up for a sharp, one down for a flat. A♯ and B♭ are practiced as separate notes.'],
  ['Exercise 3 · Two Notes', 'One note going up the strings, another coming back down, without pausing.'],
  ['Exercise 4 · Random', 'All seven naturals in a shuffled order, one note per beat.'],
  ['Increase BPM', 'Then raise the tempo bit by bit. Clean at 80 BPM, and you know your fretboard.'],
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
            A practice tool for Thomas’s fretboard method (Music Tutoring for Guitar). Play along on your guitar and your
            microphone checks each note as you go.
          </p>
        </header>

        <ul className="welcome-promises">
          {PROMISES.map((p) => (
            <li key={p.title}>
              <h2>{p.title}</h2>
              <p>{p.body}</p>
            </li>
          ))}
        </ul>

        <section className="welcome-method" aria-labelledby="welcome-method-title">
          <h2 id="welcome-method-title" className="label">
            The method
          </h2>
          <ol>
            {STEPS.map(([name, desc]) => (
              <li key={name}>
                <span className="welcome-step">{name}</span>
                <span className="muted">{desc}</span>
              </li>
            ))}
          </ol>
          <p className="muted welcome-rules">
            Do them in order, and don’t rush the tempo: too much pressure early on keeps your brain from learning.
          </p>
        </section>

        <footer className="welcome-foot">
          <span className="muted">Uses your microphone. Your audio never leaves this device.</span>
          <button ref={start} type="button" className="btn primary welcome-start" onClick={onStart}>
            Let’s start
          </button>
        </footer>
      </div>
    </div>
  )
}
