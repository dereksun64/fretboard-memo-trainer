import { useCallback, useEffect, useState } from 'react'
import { canIncreaseBpm, increaseBpm, recordBasicsClear, recordRun, type Progress } from '../engine/progress'
import type { ExerciseId } from '../engine/pools'
import { loadProgress, saveProgress } from '../engine/storage'
import { App as Lab } from '../prototype/App'
import { Basics } from '../ui/Basics'
import { StyleContext } from '../ui/decor'
import { Home } from '../ui/Home'
import { Play } from '../ui/Play'
import { useSettings } from './settings'

type Route = { name: 'home' } | { name: 'basics' } | { name: 'play'; exercise: ExerciseId } | { name: 'lab' }

function parseRoute(hash: string): Route {
  const path = hash.replace(/^#\/?/, '')
  if (path === 'basics') return { name: 'basics' }
  if (path === 'lab') return { name: 'lab' }
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
  const exercise = route.name === 'play' ? route.exercise : null
  const onRunFinished = useCallback(
    (cleared: boolean) => {
      if (exercise) setProgress((p) => recordRun(p, exercise, cleared))
    },
    [exercise],
  )

  if (route.name === 'lab') {
    return (
      <div className="lab">
        <Lab />
      </div>
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
        {route.name === 'basics' && (
          <Basics
            progress={progress}
            windowStart={settings.windowStart}
            onRunCleared={onBasicsCleared}
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
