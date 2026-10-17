import { useCallback, useEffect, useState } from 'react'
import { canIncreaseBpm, increaseBpm, pickBasicsNote, recordBasicsClear, recordRun, type Progress } from '../engine/progress'
import type { ExerciseId } from '../engine/pools'
import { loadProgress, saveProgress } from '../engine/storage'
import { App as Lab } from '../prototype/App'
import { About } from '../ui/About'
import type { Natural } from '../music/notes'
import { Basics } from '../ui/Basics'
import { AppearanceControls } from '../ui/AppearanceControls'
import { StyleContext } from '../ui/decor'
import { Home } from '../ui/Home'
import '../ui/home.css'
import '../ui/play.css'
import { Play } from '../ui/Play'
import { useSettings } from './settings'

type Route =
  | { name: 'home' }
  | { name: 'basics' }
  | { name: 'play'; exercise: ExerciseId }
  | { name: 'lab' }
  | { name: 'about' }

function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  if (path === 'basics') return { name: 'basics' }
  if (path === 'lab') return { name: 'lab' }
  if (path === 'about') return { name: 'about' }
  const m = /^play\/([1-4])$/.exec(path)
  if (m) return { name: 'play', exercise: Number(m[1]) as ExerciseId }
  return { name: 'home' }
}

function useRoute(): Route {
  const [route, setRoute] = useState(() => parseRoute(location.hash))
  useEffect(() => {
    const on = () => setRoute(parseRoute(location.hash))
    addEventListener('hashchange', on)
    return () => removeEventListener('hashchange', on)
  }, [])
  return route
}

export function App() {
  const route = useRoute()
  const [settings, updateSettings] = useSettings()
  const [progress, setProgress] = useState<Progress>(() => loadProgress(Math.random))

  useEffect(() => saveProgress(progress), [progress])

  const onBasicsCleared = useCallback(() => setProgress((p) => recordBasicsClear(p)), [])
  const onBasicsPick = useCallback((note: Natural) => setProgress((p) => pickBasicsNote(p, note)), [])
  const exercise = route.name === 'play' ? route.exercise : null
  const onRunFinished = useCallback(
    (cleared: boolean) => {
      if (exercise) setProgress((p) => recordRun(p, exercise, cleared))
    },
    [exercise],
  )

  if (route.name === 'lab') {
    return (
      <StyleContext.Provider value={settings.style}>
        <div className="app lab">
          <header className="lab-bar">
            <a href="#/" className="back">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="square" aria-hidden="true">
                <path d="M15 18l-6-6 6-6" />
              </svg>
              <span className="back-name">Exercises</span>
            </a>
            <AppearanceControls settings={settings} onSettings={updateSettings} />
          </header>
          <div className="lab-body">
            <Lab />
          </div>
        </div>
      </StyleContext.Provider>
    )
  }

  return (
    <StyleContext.Provider value={settings.style}>
      <div className="app">
        {route.name === 'home' && (
          <Home
            progress={progress}
            settings={settings}
            onSettings={updateSettings}
            onIncreaseBpm={(delta) => {
              if (canIncreaseBpm(progress)) setProgress(increaseBpm(progress, delta, Math.random))
            }}
          />
        )}
        {route.name === 'about' && <About />}
        {route.name === 'basics' && (
          <Basics
            progress={progress}
            windowStart={settings.windowStart}
            onRunCleared={onBasicsCleared}
            onPickNote={onBasicsPick}
          />
        )}
        {route.name === 'play' && (
          <Play
            key={route.exercise}
            exercise={route.exercise}
            progress={progress}
            windowStart={settings.windowStart}
            onRunFinished={onRunFinished}
          />
        )}
      </div>
    </StyleContext.Provider>
  )
}
