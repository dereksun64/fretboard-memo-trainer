import { Stripe } from './decor'
import './about.css'

export function About() {
  return (
    <main className="page about">
      <a href="#/" className="back">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
          <path d="M15 18l-6-6 6-6" />
        </svg>
        <span className="back-name">Exercises</span>
      </a>

      <header>
        <h1 className="display">About Fretboard Trainer</h1>
        <Stripe width={140} />
        <p className="lead">
          A practice tool for memorizing every note on the guitar fretboard. Play along with the exercises and your
          microphone checks each note as you go.
        </p>
      </header>

      <section>
        <h2 className="label">The method</h2>
        <p>
          The exercises follow the fretboard-memorization method taught by Thomas of Music Tutoring for Guitar. Finding
          notes is the slowest part of playing for most guitarists, and there is no shortcut: you have to actually know
          where each note is. Five minutes a day, done in order, gets you there.
        </p>
        <ul>
          <li>
            <strong>Basics</strong>: find one note on every string, low to high and back, at your own pace.
          </li>
          <li>
            <strong>Exercises 1–4</strong> add a metronome: naturals, sharps and flats, two notes at once, then a random
            order. Each unlocks when you clear the one before.
          </li>
          <li>
            <strong>Level</strong> is your tempo. Start at 40 BPM, clear all four exercises to increase it, and aim for
            80 BPM.
          </li>
          <li>Looking at the fretboard diagram is allowed. Don't try to memorize patterns; it works anyway.</li>
        </ul>
      </section>

      <section>
        <h2 className="label">Getting set up</h2>
        <ul>
          <li>Use standard tuning and tune up first. A laptop's built-in mic is enough.</li>
          <li>Headphones help: they keep the metronome out of the mic.</li>
          <li>
            If timing feels off, open the <a href="#/lab">detection lab</a>: <em>Latency calibration</em> lines up your
            playing with the clicks, and <em>Visual sync</em> lines up the screen with what you hear. Re-check when you
            switch speakers or headphones.
          </li>
        </ul>
      </section>

      <section id="privacy">
        <h2 className="label">Privacy</h2>
        <ul>
          <li>
            <strong>Your audio never leaves your device.</strong> The microphone is analyzed live in your browser to
            detect notes. Nothing is recorded, stored or uploaded.
          </li>
          <li>
            Your progress and settings are saved only in this browser (local storage). There are no accounts, no
            analytics and no cookies. Clearing this site's data resets your progress.
          </li>
          <li>
            Fonts are loaded from Google Fonts, so Google sees a request from your browser when the page loads.
          </li>
        </ul>
      </section>
    </main>
  )
}
