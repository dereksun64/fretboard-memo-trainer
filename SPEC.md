# Fretboard Memo Trainer — Spec

A laptop web app that walks you through Thomas's (Music Tutoring for Guitar) six-exercise method for memorizing every note on the fretboard. It has a built-in metronome and listens through the mic to judge what you play. It should feel like a rhythm game without piling on extra features.

## The method in brief

- Standard tuning, frets 1–12, no open strings. Any 12-fret window works (for example 5–16).
- Looking at a fretboard diagram is allowed. Don't try to memorize patterns.
- Do the exercises in order, 5 minutes a day.
- The goal is to play the random-sequence exercise cleanly at 80 BPM.

## Platform

- Desktop browser on a laptop, using the **built-in mic**.
- **No audio recording** is saved. The app only listens live.
- **Light and dark themes**.
- Runs entirely in the browser with no backend. Progress lives in `localStorage`.

## First launch

1. **Mic permission.** Open the mic with `echoCancellation`, `noiseSuppression` and `autoGainControl` all **off**.
2. **Tuner check.** A built-in tuner (it reuses the pitch detector) checks all 6 strings before you start.
3. **Latency calibration.** You play along with about 8 clicks, and the app stores the average input offset. It can be re-run from settings.
4. **Headphones tip.** Recommended, not required (see *Metronome bleed* below).

## Structure

```
Prologue  ──unlocks──▶  Stage 1 · Naturals
                        Stage 2 · Sharps & Flats
                        Stage 3 · Two Notes
                        Stage 4 · Random      ──clear──▶  Ascension (+BPM)
```

- **Prologue** is the only hard gate.
- Stages 1–4 are all open once the Prologue is done. The order is **recommended, not locked**.

### Passes and runs

- A **pass** is one note played on all 6 strings in one direction, either 6→1 or 1→6. That's 6 beats.
- A **round trip** is an up pass followed by a down pass, 12 beats. String 1 is played twice at the turnaround (back-to-back beats).
- Every run is **3 repetitions** of its pattern.

### Prologue (Exercise 1)

- **Wait mode**: no metronome. The app advances only when you play the correct target note.
- The fretboard diagram is always visible.
- **One run** is a single natural note: 6→1→6, ×3 (36 notes).
- A run must have zero wrong notes. A wrong note restarts that run.
- **Completion** takes two full rounds of all 7 naturals, 14 runs in all. Each round draws the notes in a new shuffled order.
- Finishing it unlocks the stages.

### Stages (Exercises 2–5)

These use **rhythm mode**: a metronome plus a six-lane highway.

| Stage | Pool per level | One run | Beats per run |
|---|---|---|---|
| 1 · Naturals | all 7 naturals | one note, 6→1→6, ×3 | 36 |
| 2 · Sharps & Flats | 7 runs covering all 5 accidental pitches, plus 2 repeats | one note, 6→1→6, ×3 | 36 |
| 3 · Two Notes | 6 pairs covering all 12 pitch classes once | note A up 6→1, note B down 1→6, ×3 | 36 |
| 4 · Random | 5 random sets | one random order of the 7 naturals, alternating up/down passes, ×3 (same order each rep) | 126 |

**Note selection is random only.** You hit play and the app draws the next item from the stage's pool for the current level. It draws without repeats until the pool is used up.

**Accidental naming:**
- The 5 accidental pitches are C#/Db, D#/Eb, F#/Gb, G#/Ab and A#/Bb. E#, Fb, B# and Cb are never used.
- Whenever an accidental appears (Stages 2 and 3), the app picks the **sharp or flat name at random**.
- In Stage 2, the 2 repeat runs use the **opposite spelling** from that pitch's first appearance at this level, so both names get practiced. *(Default; easy to change.)*

**Stage 4** uses natural notes only, matching Thomas's Exercise 5.

### Progress per level (light tracking)

- Each stage card shows how much of the pool you've cleared at the current BPM:
  - Stage 1: `5/7`
  - Stage 2: `3/7`
  - Stage 3: `4/6`
  - Stage 4: `1/5`
- A run only counts if it is **cleared**.
- All counts reset when you ascend.
- Stages 1–3 progress is informational. It is **not required** to ascend.

## Level = BPM

- You start at **40 BPM**, and the level is the BPM.
- The **progress bar** runs from 40 to 80.
- **Ascension** triggers when Stage 4 reaches **5/5 sets cleared** at your current level.
  - You choose the increase, **+1 to +10 BPM (default +5)**.
  - There's a short celebratory moment.
- **Past 80** the bar stays full and gets progressively more rainbow the higher you go. There is no cap.
- **Practice mode**: you can set any BPM freely. If it differs from your level, the run is labeled *Practice* and counts toward nothing, but it still shows judgments and results.

## Judging (rhythm mode)

For each beat, the app compares the detected note onset (after the latency offset) with the beat time.

- **Hit window** = `min(25% of beat duration, 200 ms)`, on each side of the beat.
  - That's ±200 ms up to 75 BPM, ±187 ms at 80 BPM and ±150 ms at 100 BPM.
- **Perfect** = within 40% of the hit window, e.g. ±80 ms at 40 BPM.
- **Good** = inside the hit window but not Perfect.
- **Miss** = no correct note onset within the window.
- **Wrong** = an onset inside the window with the wrong pitch.
- **Cleared** = zero Wrong and zero Miss. Perfect and Good both count as clean.
- A failed run **keeps playing to the end** so the practice still counts as reps. The results screen then shows *Failed*. *(Default; could instead stop immediately.)*

**Pitch matching:**
- The expected pitch is the exact note, octave included, of the target note on the target string within the active 12-fret window.
- Each pitch class appears exactly once per string in any 12-fret window, so expected octaves are unambiguous.
- The app **cannot tell which string** a note was played on, only the pitch. The octave check catches most wrong-string mistakes. This limitation is accepted.

## Rhythm-game feel (keep it lean)

**In:**
- Six-lane highway, one lane per string, with string 6 at the bottom like tab.
- Note cards labeled with the note name scroll toward a hit line.
- Perfect / Good / Miss / Wrong judgments appear on each hit.
- Combo counter.
- Results screen: Cleared/Failed, accuracy, Perfect/Good counts, max combo.
- Ascension animation.
- Rainbow progress bar past 80.

**Out:** coins, achievements, daily quests, skins, leaderboards and audio recording.

**Fretboard diagram:**
- Always shown in the Prologue.
- In stages it's a toggle with a keyboard shortcut, on by default, since Thomas allows looking.

## Settings

- Theme: light / dark / system.
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
- **Metronome bleed** (built-in mic plus laptop speakers):
  - Use a short click with no clear pitch.
  - Ignore detection for about 30–50 ms around each scheduled click. The app knows the exact click times.
  - Read the pitch from the sustained part of the note after the click.
  - Headphones are recommended for best results.
- **Noise floor**: measured during calibration, used to ignore fan and room noise.

## Build order

0. **Detection prototype**: mic → live note + octave + onset timing against a metronome. Confirms the built-in mic works before anything else.
1. **UI mockups**: two clickable directions, **arcade** and **minimal**, each in light and dark. Pick one.
2. **Core engine**: sequence generation for the Prologue and Stages 1–4, the judging logic and the level/progress model.
3. **Rhythm-mode UI**: highway, judgments, combo, results.
4. **Prologue (wait mode)**, onboarding (tuner + calibration) and settings.
5. **Ascension**, rainbow bar and Practice mode.

## Out of scope for now

- Weak-note drills or anything beyond Thomas's method.
- Alternate tunings, left-handed layout, mobile.
- Saving or playing back audio.
