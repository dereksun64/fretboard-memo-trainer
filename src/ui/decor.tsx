// Small style-specific flourishes. The layout is shared; these add the
// blueprint selection boxes and tags only in Blueprint.

import { createContext, useContext, type ReactNode } from 'react'
import type { Style } from '../app/settings'

export const StyleContext = createContext<Style>('plain')

export function useStyle(): Style {
  return useContext(StyleContext)
}

const HANDLE = 6
const OFFSET = -(6 + HANDLE / 2)

/** Blueprint: outline with square corner handles. Other styles: nothing. */
export function SelectionBox({ children }: { children: ReactNode }) {
  if (useStyle() !== 'blueprint') return <>{children}</>
  const corners = [
    { left: OFFSET, top: OFFSET },
    { right: OFFSET, top: OFFSET },
    { left: OFFSET, bottom: OFFSET },
    { right: OFFSET, bottom: OFFSET },
  ]
  return (
    <span className="sel" style={{ display: 'inline-block' }}>
      {children}
      {corners.map((c, i) => (
        <span key={i} className="handle" aria-hidden="true" style={c} />
      ))}
    </span>
  )
}

/** A short highlighted label: blueprint "TEXT↵/" tag, plain accent text. */
export function Tag({ children }: { children: ReactNode }) {
  const style = useStyle()
  if (style === 'plain') {
    return <span style={{ color: 'var(--accent-ink)', fontWeight: 600, textTransform: 'capitalize' }}>{children}</span>
  }
  return (
    <span className="tag">
      {children}
      {style === 'blueprint' ? '↵/' : ''}
    </span>
  )
}
