// Style (Plain / Blueprint / Retro) and theme (system / light / dark)
// switches, shared by the home screen and the detection lab.

import type { Settings, Style, Theme } from '../app/settings'

const STYLES: [Style, string][] = [
  ['plain', 'Plain'],
  ['blueprint', 'Blueprint'],
  ['retro', 'Retro'],
]
const NEXT_THEME: Record<Theme, Theme> = { system: 'light', light: 'dark', dark: 'system' }

interface Props {
  settings: Settings
  onSettings: (patch: Partial<Settings>) => void
}

export function AppearanceControls({ settings, onSettings }: Props) {
  return (
    <div className="head-controls">
      <div className="segmented" role="group" aria-label="Style">
        {STYLES.map(([value, label]) => (
          <button
            key={value}
            type="button"
            className="seg"
            aria-pressed={settings.style === value}
            onClick={() => onSettings({ style: value })}
          >
            {label}
          </button>
        ))}
      </div>
      <button
        type="button"
        className="btn ghost theme-btn"
        onClick={() => onSettings({ theme: NEXT_THEME[settings.theme] })}
        aria-label={`Theme: ${settings.theme}. Switch theme`}
        title={`Theme: ${settings.theme}`}
      >
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" aria-hidden="true">
          <circle cx="12" cy="12" r="8" />
          <path d="M12 4a8 8 0 0 1 0 16z" fill="currentColor" />
        </svg>
        <span className="label muted">{settings.theme}</span>
      </button>
    </div>
  )
}
