# Fretboard Trainer

Learn every note on the guitar fretboard with five minutes a day of play-along exercises. The app listens through your microphone and checks each note in the browser; audio is never recorded or uploaded.

It follows the fretboard-memorization method taught by Thomas of Music Tutoring for Guitar: Basics, then four metronome exercises, at a tempo that rises from 40 to 80 BPM as you clear them. See [SPEC.md](SPEC.md) for the full design.

## Develop

```bash
npm install
npm run dev      # http://localhost:5173
npm test         # unit tests (detector, engine)
npm run build    # production build in dist/
```

Routes: `#/` home, `#/basics`, `#/play/1`–`#/play/4`, `#/about`, `#/lab` (mic detection, latency and visual-sync calibration).

The microphone only works on `localhost` or over HTTPS.

## Deploy (Vercel)

1. Import this repo at [vercel.com/new](https://vercel.com/new). Vercel detects Vite: build `npm run build`, output `dist`.
2. Production deploys from `main`; every other branch and PR gets a preview URL.
3. Social preview images use the production domain automatically. For a custom domain, set the `SITE_URL` environment variable (e.g. `https://fretboardtrainer.com`).

`vercel.json` sets long-lived caching for hashed assets and limits microphone access to this site.
