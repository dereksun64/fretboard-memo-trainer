// Per-viewer appearance settings, kept in localStorage.

import { useEffect, useState } from 'react'

export type Style = 'plain' | 'blueprint' | 'retro'
export type Theme = 'light' | 'dark' | 'system'

export interface Settings {
  style: Style
  theme: Theme
  /** First fret of the 12-fret window (1 = frets 1-12). */
  windowStart: number
}

const KEY = 'fmt.settings'
const DEFAULTS: Settings = { style: 'plain', theme: 'system', windowStart: 1 }

function load(): Settings {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) return { ...DEFAULTS, ...(JSON.parse(raw) as Partial<Settings>) }
  } catch {
    // unreadable: defaults
  }
  return DEFAULTS
}

function systemDark(): boolean {
  return typeof matchMedia === 'function' && matchMedia('(prefers-color-scheme: dark)').matches
}

/** Settings state, persisted, with the resolved light/dark mode applied to <html>. */
export function useSettings(): [Settings, (patch: Partial<Settings>) => void] {
  const [settings, setSettings] = useState<Settings>(load)
  const [dark, setDark] = useState(systemDark)

  useEffect(() => {
    if (typeof matchMedia !== 'function') return
    const mq = matchMedia('(prefers-color-scheme: dark)')
    const on = () => setDark(mq.matches)
    mq.addEventListener('change', on)
    return () => mq.removeEventListener('change', on)
  }, [])

  const mode = settings.theme === 'system' ? (dark ? 'dark' : 'light') : settings.theme
  useEffect(() => {
    const root = document.documentElement
    root.dataset.style = settings.style
    root.dataset.theme = mode
  }, [settings.style, mode])

  const update = (patch: Partial<Settings>) => {
    setSettings((s) => {
      const next = { ...s, ...patch }
      try {
        localStorage.setItem(KEY, JSON.stringify(next))
      } catch {
        // session only
      }
      return next
    })
  }
  return [settings, update]
}
