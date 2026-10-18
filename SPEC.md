# Fretboard Memo Trainer — Spec

A laptop web app that walks you through Thomas's (Music Theory for Guitar) six-exercise method for memorizing every note on the fretboard. It has a built-in metronome and listens through the mic to judge what you play. It should feel like a rhythm game without piling on extra features.

## The method in brief

- Standard tuning, frets 1–12, no open strings. Any 12-fret window works (for example 5–16).
- Looking at a fretboard diagram is allowed. Don't try to memorize patterns.
- Do the exercises in order, 5 minutes a day.
- The goal is to play the random-sequence exercise cleanly at 80 BPM.

## Platform

- Desktop browser on a laptop, using the **built-in mic**.
- **No audio recording** is saved. The app only listens live.
- **Two styles (Plain, Blueprint) × light and dark** (see *Visual design*).
- Runs entirely in the browser with no backend. Progress lives in `localStorage`.

## First launch

0. **Welcome overlay** *(built)*. On a browser's first visit, a full-screen overlay covers the app until **Let's start**.
   - It shows the method's promises, quoted as Thomas's: the reliable way, five minutes a day, nothing to memorize, and it works for everyone who finishes.
   - A linked thumbnail of Thomas's video ([youtu.be/PJddQ6Q0UDo](https://youtu.be/PJddQ6Q0UDo), YouTube's own `hqdefault` image cropped to 16:9) opens it in a new tab. There's no embedded player.
   - Copy is kept short: one line per promise and per step.
   - It also summarizes the method: Basics → Exercises 1–4 → Increase BPM toward 80, done in order and without rushing the tempo.
   - It notes that the mic is used and audio stays on the device.
   - The app underneath is `inert` and its keyboard shortcuts are blocked. Let's start sets `fmt.welcomed`, so it doesn't show again; **Clear local data** brings it back.
1. **Mic permission.** Open the mic with `echoCancellation`, `noiseSuppression` and `autoGainControl` all **off**.
2. **Tuner check.** A built-in tuner (it reuses the pitch detector) checks all 6 strings before you start.
3. **Latency calibration.** You play along with about 8 clicks, and the app stores the average input offset. It can be re-run from settings.
4. **Headphones tip.** Recommended, not required (see *Metronome bleed* below).

## Structure

**Vocabulary.** The UI uses plain words, not game jargon: **Basics**, **Exercise 1–4**, **Level** (= BPM) and **Increase BPM**. App Exercises 1–4 are Thomas's Exercises 2–5; Basics is his Exercise 1.

```
Basics ─▶ Exercise 1 ─▶ Exercise 2 ─▶ Exercise 3 ─▶ Exercise 4 ─▶ Increase BPM
          Naturals      Sharps &      Two Notes     Random            │
             ▲          Flats                                         │
             └──────── exercises relock at the new BPM ◀──────────────┘
```

- **Basics** is done once and unlocks Exercise 1.
- **Exercises unlock in order within each level.** An exercise opens only when the previous exercise's whole pool is cleared at the current BPM (e.g. Exercise 1 at 7/7 opens Exercise 2).
- **Clear all exercises to increase BPM.** Clearing Exercise 4 finishes the level and offers the BPM increase. At the new BPM, Exercise 1 is open again and Exercises 2–4 are locked.
- **Practice mode** ignores locks: any exercise, any BPM, counting toward nothing.

### Passes and runs

- A **pass** is one note played on all 6 strings in one direction, either 6→1 or 1→6. That's 6 beats.
- A **round trip** is an up pass followed by a down pass, 12 beats. String 1 is played twice at the turnaround (back-to-back beats).
- Every run is **3 repetitions** of its pattern.

### Basics (Thomas's Exercise 1)

- **Wait mode**: no metronome. The app advances only when you play the correct target note.
- The fretboard diagram starts visible; **Diagram** (D) hides it. **Restart** (R) plays the same note again from the top. A footer shows hits and wrong notes, like the exercises.
- **One run** is a single natural note: 6→1→6, ×3 (36 notes).
- A wrong note doesn't restart or fail the run. The app shows what it heard ("Wrong · heard G#3, try again") and keeps waiting for the correct note. The results mention how many wrong notes there were. Wrong notes before the first correct note are ignored (not shown, not counted).
- **Pick a note**: clicking the big letter opens a picker of the 7 naturals, each showing how many of its runs are left (no letter shortcuts; click a note to pick it, Esc or a click outside closes it). A pick with runs left moves that note to the front of the queue, so the run counts and the queue still holds each note once. A note with none left (or any pick once Basics is done) plays as a replay that doesn't count.
- **Random note** (Tab, or the footer button) jumps to a random different note, preferring notes whose run still counts. Shift+Tab still moves focus.
- **Start / Stop** (Space) works exactly as in the exercises: the note sits ready until Start, and Stop puts it back, ready. The mic is ignored while not started. Picking or randomizing a note keeps the current state (ready stays ready, playing keeps playing).
- **Skip Basics** (in the Basics header, and *Skip* on its Home row) marks Basics done and unlocks Exercise 1.
- **Completion** takes one run of each of the 7 naturals, 7 runs in all, in a shuffled order.
- Finishing it unlocks Exercise 1.

### Exercises 1–4 (Thomas's Exercises 2–5)

These use **rhythm mode**: a metronome plus a six-lane highway.

| Exercise | Pool per level | One run | Beats per run |
|---|---|---|---|
| 1 · Naturals | all 7 naturals | one note, 6→1→6, ×3 | 36 |
| 2 · Sharps & Flats | 7 runs covering all 5 accidental pitches, plus 2 repeats | one note, 6→1→6, ×3 | 36 |
| 3 · Two Notes | 6 pairs covering all 12 pitch classes once | note A up 6→1, note B down 1→6, ×3 | 36 |
| 4 · Random | 5 random sets | one random order of the 7 naturals, alternating up/down passes, ×3 (same order each rep; the alternation carries across reps, so there's never a jump from string 1 back to 6) | 126 |

**Note selection is random only.** Each exercise's pool is shuffled when a level starts, and you hit play to get the next uncleared run. A **failed run moves to the back** of the remaining runs, so the next attempt is a different note.

**Accidental naming:**
- The 5 accidental pitches are C#/Db, D#/Eb, F#/Gb, G#/Ab and A#/Bb. E#, Fb, B# and Cb are never used.
- Whenever an accidental appears (Exercises 2 and 3), the app picks the **sharp or flat name at random**.
- In Exercise 2, the 2 repeat runs use the **opposite spelling** from that pitch's first appearance at this level, so both names get practiced. *(Default; easy to change.)*

**Exercise 4** uses natural notes only, matching Thomas's Exercise 5.

### Progress per level (light tracking)

- Each exercise shows how much of its pool you've cleared at the current BPM, e.g. Exercise 1 at `5/7` (Exercises 2–4 locked).
- The home screen also shows how many exercises are cleared at this level (`0/4`) next to the hint *"Clear all exercises to increase BPM."*
- A run only counts if it is **cleared**.
- All counts reset when you increase BPM.
- An exercise's count is what unlocks the next exercise (see *Structure*).

## Level = BPM

- You start at **40 BPM**, and the level is the BPM.
- The **progress bar** runs from 40 to 80.
- **Increase BPM** is offered when Exercise 4 reaches **5/5 sets cleared** at your current level. Because exercises are gated, that means the whole level (Exercises 1–4) is done.
  - You choose the increase, **+1 to +10 BPM (default +5)**.
  - There's a short celebratory moment.
- **Past 80** the bar stays full and gets progressively more rainbow the higher you go. There is no cap.
- **Practice mode**: you can set any BPM freely. If it differs from your level, the run is labeled *Practice* and counts toward nothing, but it still shows judgments and results.

## Judging (rhythm mode)

For each beat, the app compares the detected note onset (after the latency offset) with the beat time.

- **Hit window** = `min(25% of beat duration, 200 ms)`, on each side of the beat.
  - That's ±200 ms up to 75 BPM, ±187 ms at 80 BPM and ±150 ms at 100 BPM.
  - The window isn't shown in the UI; the per-note offset (e.g. "+24 ms") still is.
- **Perfect** = within 40% of the hit window, e.g. ±80 ms at 40 BPM.
- **Good** = inside the hit window but not Perfect.
- **Miss** = no correct note onset within the window.
- **Wrong** = an onset inside the window with the wrong pitch. A wrong note before the first beat (in the count-in, even inside beat 1's window) is ignored, so it can't spoil beat 1.
- **Cleared** = zero Wrong and zero Miss. Perfect and Good both count as clean.
- **Accuracy** = (Perfect + 0.9 × Good) ÷ judged beats. **Combo** counts consecutive Perfect/Good and resets on Miss or Wrong.
- **Runs always play to the end.** Misses and wrong notes never stop or pause the run; detection errors are too common for that.
- **Nothing starts on its own.** Opening an exercise, **Next run** and **Try again** all lay the run out on the highway, ready, with "Press [Space] to start". The hint and the Start button pulse gently (every 1.6 s) until the run starts; the pulse is off under reduced motion.
  - The hint shows by default until the first run of the visit starts (a page-wide flag, not saved). After that, a ready run shows it only once the page has had no pointer, key or touch input for 3 s; any input hides it again. Hidden, it keeps its space.
- **Start / Stop** (the last footer button, shortcut **Space**) starts the count-in. While a run plays the same button reads **Stop**: Space again stops the clicks and puts the same run back, ready, without leaving the exercise (after a cleared run, Stop readies the next one). **Esc** (shown on the back link) leaves.
- **Restart** (button beside Diagram, shortcut **R**) replays the same run from the top right away; the abandoned attempt isn't recorded.
- **With mistakes**, the end of the run plays a soft error sound and a popup says *We think you made a few mistakes (2 missed, 1 wrong). Try again?*, with the stats, a small *Calibrate in lab →* link and two buttons:
  - **Try again** (suggested, focused) replays the same run. Nothing is recorded.
  - **I think I got it** counts the run as cleared, for when the mic misheard.
  - Leaving without choosing records nothing.

**Pitch matching:**
- The expected pitch is the exact note, octave included, of the target note on the target string within the active 12-fret window.
- Each pitch class appears exactly once per string in any 12-fret window, so expected octaves are unambiguous.
- The app **cannot tell which string** a note was played on, only the pitch. The octave check catches most wrong-string mistakes. This limitation is accepted.

## Rhythm-game feel (keep it lean)

**In:**
- Six-lane highway, one lane per string, labelled **e B G D A E** (high e on top, like tab). Prose says "high e" / "low E".
- Note circles labelled with the note name scroll toward a hit line, with an **osu-style approach circle** shrinking onto each note as its beat nears.
- Notes **only appear on the highway**: nothing is drawn past the lanes' right end, and each note fades in over its first ~1.2 beats on the highway.
- When a note is judged, its colours **ease over 0.35 s** (e.g. the lit next note turning into a miss) instead of snapping.
- Notes **keep sliding past the hit line and fade out** in their judgment colour (they never snap to a dot); at the end of a run the last note fades before the results appear.
- A short **hit burst** on the hit line, styled per theme: a ring (Plain), a square selection box with corner handles (Blueprint). Reduced-motion users get no approach circles and non-scaling bursts.
- **Fixed layout**: changing text (target note, string name, judgment, ms offset, combo, counts) sits in fixed-width slots, and results float over the highway, so nothing on the page shifts.
- **Basics uses the same highway**: each correct note slides the next onto the hit line; a wrong note flashes red on its string and the highway waits.
- Perfect / Good / Miss / Wrong judgments appear on each hit.
- Combo counter.
- Results screen: Cleared (or the mistakes popup), accuracy, Perfect/Good counts, max combo.
- A short celebration when you increase BPM.
- Rainbow progress bar past 80.

**Out:** coins, achievements, daily quests, skins, leaderboards and audio recording.

**Run-screen layout** (Basics and Exercises alike):
- Header, top right: the BPM (Basics: runs done), with a **Ready / Listening / Hearing C3** status under it.
- Footer row: counts on the left, the pulsing "Press [Space] to start" in the middle, and the buttons on the right: (Random,) **Restart**, **Start/Stop** (Start/Stop rightmost). The buttons stay right-aligned when the row wraps.
- Under the counts: a **Diagram** disclosure row (also D). Its arrow turns and the fretboard diagram slides open or shut. Open by default, since Thomas allows looking.

## Visual design

One layout, the calm **Minimal** layout (direction B on the design canvas), with a **Style** setting that reskins it. Every style has light and dark modes.

| Style | Look |
|---|---|
| **Plain** | Geist type, hairlines, outlined note circles, one blue accent. |
| **Blueprint** | Grid background, Bodoni serif letters and numbers with condensed labels, cobalt selection boxes with corner handles, `↵/` tags, the hit line drawn as a measured axis. Notes look like the other styles (outlined circles, solid next note): never hexagons, and no selection box on the next note. |

- The layout and components are shared; a style is a set of design tokens (colours, fonts, textures) plus a few style-specific decorations.
- Mockups and the interactive Style preview live on the design canvas: https://claude.ai/artifact/Rm2VGCE6t9Zuyqz3iceQMd

## Settings

- Theme: light / dark / system.
- Style: Plain / Blueprint. (Retro was removed; a saved Retro choice falls back to Plain.)
- Fret window start (default fret 1, so 1–12; e.g. 5 gives 5–16).
- Re-run latency calibration.
- Tuner.
- Metronome volume and click sound.

## Technical notes

- **Stack**: Vite + React + TypeScript, everything client-side.
- **Metronome**: Web Audio API with a lookahead scheduler (scheduled against `AudioContext.currentTime`, not `setInterval`). Accent on beat 1 is optional.
- **Mic capture**: an `AudioWorklet` sends sample blocks stamped with their exact frame, so onsets share the metronome's clock.
- **Onset detection**: SuperFlux-style spectral flux (2048-point FFT, compared with a max-filtered spectrum 2 hops back), so new plucks are caught even over a ringing note.
- **Note naming**: compares the spectrum just before the onset with the one ~25 ms after it.
  - It subtracts the estimated decay of whatever was already ringing.
  - It scores every candidate pitch by energy on its harmonics minus energy between them, which avoids octave errors.
  - If almost nothing is new but the sound got louder, it's the same pitch plucked again.
  - Onsets without harmonic content (clicks, mutes) are dropped.
- **Live tuner readout**: McLeod pitch method (`pitchy`).
- **Tests**: synthetic plucked strings in `src/audio/analyzer.test.ts`, covering ringing notes, a weak-bass "laptop mic" high-pass, click bleed, quiet playing, every note on every string and up to 140 BPM.
- **Visual sync**: the highway is drawn on the *heard* audio clock (`AudioContext.getOutputTimestamp`, falling back to `currentTime − outputLatency`), so the playhead lines up with the clicks you hear rather than the audio thread's render-ahead time. A per-device **visual delay** (lab → Visual sync, −150 to +350 ms) covers whatever the browser doesn't report, e.g. Bluetooth headphones.
- **Metronome bleed** (built-in mic plus laptop speakers):
  - Use a short click with no clear pitch.
  - Ignore detection for about 30–50 ms around each scheduled click. The app knows the exact click times.
  - Read the pitch from the sustained part of the note after the click.
  - Headphones are recommended for best results.
- **Noise floor**: measured during calibration, used to ignore fan and room noise.

## Build order

0. **Detection prototype**: mic → live note + octave + onset timing against a metronome. Confirms the built-in mic works before anything else.
1. **UI mockups** *(done)*: chose B's layout with a style setting (now Plain / Blueprint; Retro was dropped).
2. **Core engine** *(done)*: `src/engine/` — pools (`pools.ts`), run sequences (`sequence.ts`), judging and run summary (`judge.ts`), Basics wait mode (`waitMode.ts`), progress/locking/BPM increase (`progress.ts`) and `localStorage` persistence (`storage.ts`), all pure and unit-tested.
3. **Rhythm-mode UI** *(done)*: Home (level bar, in-order exercise list, style + theme switch), Play (count-in, live highway, judgments, combo, results, diagram on D, Start/Stop on Space, Esc to leave) and Basics (wait mode). Routes: `#/`, `#/basics`, `#/play/1`–`4`, `#/lab` (detection prototype).
4. **Onboarding** (mic check, tuner, latency calibration in-app instead of the lab) and a settings screen (fret window, metronome volume).
5. **Practice mode**, a proper Increase BPM celebration (the basic increase flow already works), and pause instead of stop.

## Hosting

- Static site on **Vercel**: production from `main`, a preview URL for every branch and PR. HTTPS is required for the mic.
- `vercel.json`: immutable caching for `/assets/*`, `Permissions-Policy: microphone=(self)`.
- Share previews (`og:image` etc.) use `SITE_URL` or Vercel's production domain.
- Launch pages: `#/about` (method, setup tips, privacy note). Mic-permission errors explain how to allow the mic.

## Out of scope for now

- Weak-note drills or anything beyond Thomas's method.
- Alternate tunings, left-handed layout, mobile.
- Saving or playing back audio.

## Local data

- Everything lives in this browser's localStorage under `fmt.*` keys (progress, appearance settings, latency and visual calibration).
- **Clear local data** (Home footer) asks for confirmation, then erases all `fmt.*` keys and reloads for a full restart.
