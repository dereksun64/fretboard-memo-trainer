# CLAUDE.md

This is the working guide for this repo.
- `SPEC.md` is the source of truth for **what** the app does: rules, pools, judging and visual design.
- This file covers **how** to work here: structure, conventions, testing, and the lessons from past corrections.

Keep both current. A change to a rule updates `SPEC.md` in the same change. A correction from the owner gets a line under [Lessons](#lessons).

---

## About

**Fretboard Trainer** is a web app for memorizing every note on the guitar fretboard. It follows the method taught by Thomas of *Music Theory for Guitar*.

- **Input:** you play a real guitar into your laptop's built-in mic. The app detects each note and judges it, rhythm-game style (think Yousician), with a built-in metronome.
- **Privacy:** audio is analyzed live and never recorded or uploaded. Everything is stored in this browser's localStorage.
- **Look:** a minimal rhythm-game feel with no junk features. There are two visual styles (Plain, Blueprint), each in light and dark.
- **Hosting:** live on Vercel. Production deploys from `main`, and every PR gets a preview.
  - Repo: `github.com/dereksun64/fretboard-memo-trainer` (public).
- **Stack:** Vite 8, React 19, TypeScript 5.9 and vitest. There's no UI framework or state library. `pitchy` is used only for the live tuner readout.

## Terminology

Use these words in UI copy, code and commits. Don't use game jargon such as prologue, stage or ascend.

| Term | Meaning |
|---|---|
| **Basics** | Thomas's Exercise 1. Untimed **wait mode**: the app waits for each correct note. 7 runs, one per natural note. Clearing it unlocks Exercise 1. |
| **Exercise 1–4** | Thomas's Exercises 2–5, in **rhythm mode** with a metronome. 1 = Naturals, 2 = Sharps & Flats, 3 = Two Notes, 4 = Random. They unlock strictly in order. |
| **Level** | The BPM runs count at. Starts at 40; the progress bar targets 80 and turns rainbow past it. |
| **Increase BPM** | Offered once all four exercises are cleared: +1 to +10 (default +5). Then Exercises 2–4 relock with fresh pools. |
| **Pool** | The set of runs an exercise draws per level (`PoolItem`: `note`, `pair` or `sequence`). All of them must be cleared to unlock the next exercise. |
| **Run** | One pool item played as a pattern ×3 (`REPS`). For a single note: string 6→1→6, three times = 36 beats. |
| **Pass** | One sweep across all 6 strings in one direction. Accents fall on the start of each pass. |
| **Step / Beat** | One note to play: a `Step` holds note and string; a `BeatTarget` holds its time and expected MIDI pitch. |
| **Hit window** | ±min(25% of a beat, 200 ms). *Perfect* is the inner 40% of it, *Good* is the rest. *Miss* means nothing was played in the window. *Wrong* means a wrong pitch inside it. |
| **Cleared** | A run with no Miss and no Wrong, or one the player passed with **I think I got it**. |
| **Practice mode** | Any exercise at any BPM; it never touches progress. Planned, not built yet. |
| **Lab / detection lab** | `#/lab`: mic tuner, note log, detector settings, latency calibration, visual sync and a metronome run test. |
| **Style / Theme** | Style is Plain or Blueprint. Theme is system, light or dark. Both are set on `<html data-style data-theme>`. |
| **Window** | The 12-fret window notes are expected in (`windowStart`, default frets 1–12). |

Strings are numbered the way guitarists do: **6 = low E … 1 = high e**. Lane labels read `e B G D A E`, and the high **e** stays lowercase.

## Repo structure

```
SPEC.md                 product rules and design. Read before changing behavior.
CLAUDE.md               this guide
index.html              meta/OG tags (%SITE_URL% filled by vite.config.ts), Google Fonts
vite.config.ts          React plugin + siteUrl plugin (SITE_URL / VERCEL_PROJECT_PRODUCTION_URL)
vercel.json             cache headers, Permissions-Policy: microphone=(self)
public/
  capture-worklet.js    AudioWorklet: posts frame-stamped 512-sample mic blocks
  favicon.svg, apple-touch-icon.png, og.png
.claude/launch.json     "dev" server config (port 5173) for the browser pane
src/
  main.tsx              mounts <App/>
  app/                  app shell: routing, settings, shared hooks, design tokens
    App.tsx             hash router; owns Progress state and persists it
    navigate.ts         navigate('/basics') etc.
    settings.ts         useSettings(): style, theme, windowStart (fmt.settings)
    audio.ts            getAudioEngine() singleton (needs a user gesture); micHelp() error text
    useNow.ts           useFrameValue(): per-frame value, with a timer fallback for hidden tabs
    tokens.css          CSS variables for 2 styles × 2 modes
  audio/                Web Audio: no React in here
    engine.ts           AudioEngine: mic → worklet → analyzer, metronome, clocks, calibration
    analyzer.ts         NoteAnalyzer: SuperFlux onsets + spectral note naming
    fft.ts              radix-2 magnitude spectrum
    metronome.ts        lookahead click scheduler, runAccents()
    sfx.ts              playMissSound()
  engine/               pure game logic: no DOM, no audio, fully unit-tested
    progress.ts         Progress value + pure updates (Basics, unlocks, Increase BPM)
    pools.ts            ExerciseId, PoolItem, basicsQueue(), drawPool()
    sequence.ts         Step, REPS, runSteps() for note / pair / sequence runs
    judge.ts            hit windows, judgeBeats(), beatTargets(), summarize()
    waitMode.ts         Basics wait-mode state machine (startWait, feedWait)
    storage.ts          guarded load/save of fmt.progress, clearLocalData()
    rng.ts              seeded(), shuffle(), randomInt(): randomness is injected
  music/notes.ts        note names, pitch classes, fret/MIDI math, string labels
  ui/                   screens and shared visual pieces
    Home.tsx            level + bar, Increase BPM, exercise list, Skip Basics, Clear local data
    Basics.tsx          wait-mode run screen, note picker, BasicsHighway
    Play.tsx            rhythm-mode run screen (ready → count-in → judging → results / mistakes popup)
    controls.tsx        run-screen controls shared by Basics and Play: StartStop, StartHint
                        (page-wide `hintSeen` flag + 3 s idle), ListenStatus, DiagramSection
    Highway.tsx         six-lane note highway (approach circles, fades, bursts)
    FretDiagram.tsx     fretboard chart for the current window
    decor.tsx           StyleContext, SelectionBox, Tag (Blueprint flourishes)
    AppearanceControls.tsx  style + theme switches (Home and Lab)
    Welcome.tsx         first-visit overlay (promises + method summary, "Let's start"; fmt.welcomed)
    About.tsx, exercises.ts (names/descriptions), *.css
  prototype/            the detection lab (#/lab); styles scoped under .lab-body
```

## How the pieces work

**Routing and state.** `App.tsx` parses `location.hash` into one of these routes:
- `#/` → `Home`
- `#/basics` → `Basics`
- `#/play/1`–`#/play/4` → `Play`
- `#/lab`
- `#/about`

`App` owns the single `Progress` value, saves it on every change, and passes it down along with callbacks: `onRunFinished`, `onRunCleared`, `onPickNote`, `onSkip` / `onSkipBasics` and `onIncreaseBpm`. Screens never write to storage themselves.

**Progress is a pure value.** Every rule is a pure function in `engine/progress.ts`, taking a `Progress` and returning a new one: `recordRun`, `recordBasicsClear`, `pickBasicsNote`, `skipBasics`, `increaseBpm`, `isUnlocked`, `nextItem` and so on. Randomness comes in as an `Rng` argument so tests are reproducible. Add new rules here, with tests, never inside components.

**Audio pipeline.** `getAudioEngine()` creates one `AudioEngine` on the first click that needs it.
- **Input:** the mic is opened with echoCancellation, noiseSuppression and autoGainControl all off. Audio goes through `capture-worklet.js` into `NoteAnalyzer`.
- **Output:** the analyzer emits note events `{time, midi}` to `engine.onNote` listeners, and keeps `engine.livePitch` for the tuner.
- **One clock:** everything shares one `AudioContext` clock.
  - `engine.corrected(ev)` subtracts input latency (`fmt.latencyMs`). Use it for judging.
  - `engine.displayTime()` is the *heard* clock, from `getOutputTimestamp` minus `fmt.visualOffsetMs`. Use it for drawing.
- **Metronome:** `engine.metronome` schedules unpitched noise-burst clicks about 1.2 s ahead.
  - `start(bpm, {startTime, beats, accent})` replaces any running schedule.
  - `stop()` also cancels clicks that are already queued.

**Rhythm run (`Play.tsx`).**
1. A `Run` is laid out *ready* (`started: false`, clock frozen at `-LEAD`) by `readyRun()`. Nothing plays until Start or Space calls `begin()`, which starts the metronome with a 4-click count-in and re-times the beats. Stop puts the same run back, ready. Each new `Run` gets a fresh id, so `RunView` remounts.
2. Every frame, `RunView` re-judges all beats from scratch with `judgeBeats(beats, played, bpm, now)` and summarizes them. There's no incremental judge state, so judging stays a pure function of the inputs.
3. When the run finishes, a clean run is recorded and shows **Cleared**. A run with mistakes shows the **Try again / I think I got it** popup and records nothing until you choose.

**Wait-mode run (`Basics.tsx`).** Each note event goes through `feedWait()`. The highway's "clock" is the note index, eased toward the next position. The same footer controls are there: Random (Tab), Restart (R), Diagram (D) and Start / Stop (Space). The big letter opens the note picker.

**Highway.** `Highway` is presentational. It takes steps, beats, results, `now` and `spb`, and places notes by `(beat.time - now) / spb`. It draws:
- approach circles (optional);
- fades for notes past the hit line;
- hit bursts timed by wall-clock `judgedAt`, so detection lag doesn't cut them short;
- optional `flashes` (Basics' wrong-note flashes).

**Styling.**
- Colors and fonts come from CSS variables in `tokens.css`, keyed by `:root[data-style][data-theme]`.
- Style-specific rules use `:root[data-style='blueprint'] .x { … }`.
- Small per-style elements go through `decor.tsx` (`useStyle()`), not `if (style === …)` scattered through screens.

## Conventions

- **Basics and exercise runs stay in sync.** Unless told otherwise, a change requested for one run screen goes into both `Basics.tsx` and `Play.tsx`: controls, shortcuts, popups, feedback, layout. Skip one only when the change truly can't apply there (Basics has no metronome or timing), and say so.
- **Logic in `engine/`, pure and tested.** Components wire state and draw.
- **No layout shift.** Every changing piece of text (judgment, offset, combo, count-in, note) sits in a fixed-size slot. Popups float over the highway (`.results.overlay`) instead of pushing content.
- **Every feature works in both styles × both modes.** Check Blueprint and dark mode, not just Plain light. Respect reduced motion.
- **Keyboard shortcuts:** add one only when asked. The current set:
  - Runs: Space start/stop, R restart, D diagram, Esc leave (shown on the back link).
  - Basics also has Tab for a random note.
  - Every shortcut appears as a label on its button (e.g. `Restart R`).
  - Ignore keys held with Cmd, Ctrl or Alt, plus key repeats.
  - Clicking is the only way to use the note picker.
- **Storage:** keys start with `fmt.`. Wrap every access in try/catch and fall back to defaults. Don't write migrations unless asked: this is an early, single-user app.
- **Comments:** short and about *why*, in the existing style. Each file opens with a header comment saying what it is.
- **Dev hooks:** `window.__fmtRun` and similar test hooks live only behind `import.meta.env.DEV`.
- **Git:** one branch per change, then a PR into `main`. Merge with a merge commit once the Vercel checks pass. The repo doesn't allow GitHub auto-merge, so wait for the checks, then merge. Commit and merge only when asked.
- **Before committing:** run `npm run typecheck` and `npm test`.

## Testing

### Unit tests (vitest)

Run `npm test` (`vitest run`). Tests sit next to their code as `*.test.ts`.
- `engine/` and `music/` are covered thoroughly. They're pure functions; use `seeded(n)` for randomness.
- `audio/analyzer.test.ts` feeds synthetic additive plucks, not Karplus-Strong, which was unrealistic. `metronome.test.ts` covers accents.
- New rules in `engine/` need tests. Run every property over many seeds when randomness is involved.

### End-to-end in the browser pane

There's no Playwright setup. End-to-end checks run in the Claude browser pane against the dev server (`preview_start {name: "dev"}`, port 5173), using the **simulated mic** in `src/dev/simMic.ts`.

- **Load with `?sim`**, e.g. `http://localhost:5173/?sim#/basics`. In dev, this swaps `getUserMedia` for a synthetic stream; production builds don't include it. The engine is a singleton, so `?sim` must be there from page load: a fake mic patched in later never reaches an engine that's already open.
- **Reach screens by clicking** (e.g. Home → Play), as a user would. That gives the page the user activation that audio needs.
- **`window.__sim`** plays additive plucks (harmonics 1–6, ~0.6 s decay) into the stream:
  - `__sim.pluck(midi)`: pluck now.
  - `__sim.basics(offset = 0)`: play the note Basics is waiting for, or `offset` semitones off it. Uses the dev hook `__fmtBasics`.
  - `__sim.playRun({ skip, wrong, offsetMs })`: schedule a whole started exercise run on its beats. `skip` beats become misses, `wrong` beats are a semitone sharp, and `offsetMs` shifts every note. Uses the dev hook `__fmtRun`.
  - `__sim.runEndsIn()`: seconds until the started run's results show.
  - `__sim.state()`: a DOM snapshot (button, hint slot, note, string, progress, counts, overlay, Basics state).
  - `__sim.wait(ms)`: a promise-based sleep for test scripts.
- **Test systematically.** Script each flow as *action → pluck → `state()`* and keep a log. Cover arrive, start, stop, restart, random, pick, wrong-before-first, wrong-after-first, full run → next. Press keys with the `computer` key action (Space, R, D, Tab, Esc), not synthetic events, so user activation and focus behave for real.
- **Seed state:** edit `localStorage['fmt.progress']` (for example `basics.cleared` or `level`; level 80 makes runs short), then reload. **Clear local data** on Home resets everything.
- **Pane quirks:**
  - Right after `location.reload()`, the next script can run before the page mounts. Retry if `.start-stop` is null.
  - When the pane is hidden, screenshots can show a stale frame. Trust `__sim.state()` / the DOM over the image.
  - The pane may report reduced motion, which switches CSS animations off. Check `matchMedia('(prefers-reduced-motion: reduce)')` before judging an animation.
  - Hidden-pane timers are throttled.
- **Not covered:** a real guitar and real mic latency. Say so whenever reporting results.

## Lessons

Corrections from the owner and mistakes made so far. Read these before starting work.

**Process**
- *Brainstorm means brainstorm.* When asked to "help me brainstorm" or "don't create anything yet", only discuss. Build when told.
- *Don't invent requirements.* Basics was built as 14 runs (two rounds) when the owner meant 7. The extra round was my addition, and it got quietly written into SPEC.
  - Build what was asked.
  - If a number or rule isn't stated, ask or flag it as an assumption.
- *Don't over-engineer.* A save migration was unwanted ("no need to migrate").
- *Verify names and sources.* The method's channel is **Music Theory for Guitar** (Thomas; video [youtu.be/PJddQ6Q0UDo](https://youtu.be/PJddQ6Q0UDo)). The original write-up said "Music Tutoring for Guitar", and that went into the app unchecked until it was looked up.
- *Check before reporting.* I once said nothing had been pushed when the branches were already on GitHub. Check with `git` / `gh` first.

**Product**
- *Mic detection is unreliable, so never punish automatically.*
  - Pausing on the first miss was reversed. So was restarting Basics on a wrong note.
  - Runs always play to the end. Restart is the player's choice.
  - A run with mistakes ends on "We think you made a few mistakes… Try again?" with an **I think I got it** override.
  - Wrong notes before the first note are ignored, in both Basics and the exercises.
- *Keep shortcuts minimal.* Letter keys in the note picker were unwanted.
- *Respect each style.* Blueprint has no hexagon note icons, no selection box on the next note, and no "T" on the playhead. Hit effects are styled per theme.
- *Retro was removed.* Only Plain and Blueprint remain; don't reintroduce style-specific code for it.
- *Notes fade instead of snapping,* and the highway keeps scrolling past the last note before results show.
- *Lab:*
  - It has a back button and the same appearance toggles as the game, and keeps its panels in a 2×2 grid at any width.
  - The BPM field is freely editable. A valid value applies after a short pause or on Enter; an invalid value reverts.

**Technical**
- *Draw on the heard clock* (`displayTime()`), not `ctx.currentTime`. Otherwise the visuals run ahead of the clicks.
- *Metronome:*
  - Accents go on the first count-in click and each pass start, not every 4 beats.
  - `stop()` must cancel queued clicks. When the schedule runs out, clear only the interval; calling `stop()` would cut the last clicks.
  - Count-in digits use `ceil`; `round` flips half a beat early.
- *Hidden tabs throttle timers and stall rAF.* `useFrameValue` falls back to a timer, and the 1.2 s lookahead keeps clicks from dropping.
- *Detection pitfalls:*
  - A log-based harmonic score caused octave errors; use the linear harmonic-minus-inter-harmonic score.
  - The noise floor crept up while notes rang; now it only rises on unpitched input.
  - Abrupt note endings looked like onsets; that's fixed by the `afterSum < 1.2 × beforeSum` rule.
- *Lowercase high e:* `.label` uppercases text, so string names opt out (`.string-name`).
- *Never capture browser combos.* An R shortcut must not swallow Cmd+R.
- *Overlays outside `.app`:*
  - `.app` sets the base font and colour, so anything rendered beside it (like `Welcome`) must set them itself.
  - Screen shortcuts listen on `window`, so a modal must make the app `inert` and stop keys in a capture-phase `window` listener. `stopPropagation` only; the dialog's own Tab and Enter still work.
- *CSS order:* `tokens.css` loads after the component stylesheets, so a component rule that overrides `.btn` (or another base class) needs the extra specificity, e.g. `.btn.start-stop`. Otherwise it silently loses; that's how Start/Stop lost its fixed width.
