import { useEffect, useState } from 'react'

export const MIN_BPM = 20
export const MAX_BPM = 240

function parseBpm(text: string): number | null {
  if (!/^\d+$/.test(text.trim())) return null
  const n = Number(text)
  return n >= MIN_BPM && n <= MAX_BPM ? n : null
}

const SETTLE_MS = 400

/**
 * A BPM field you can clear and retype freely. A valid value (whole number,
 * 20-240) applies once you pause typing, or straight away on Enter / leaving
 * the field; waiting means typing "200" doesn't briefly apply 20. Anything
 * invalid reverts to the last valid BPM when you leave the field or press
 * Enter. Arrow keys step by 1.
 */
export function BpmInput({ value, onChange }: { value: number; onChange: (bpm: number) => void }) {
  const [draft, setDraft] = useState(String(value))

  // Follow outside changes (e.g. a reset) when they differ from the draft.
  useEffect(() => {
    setDraft((d) => (parseBpm(d) === value ? d : String(value)))
  }, [value])

  // Apply a valid draft once typing pauses.
  useEffect(() => {
    const n = parseBpm(draft)
    if (n === null || n === value) return
    const t = setTimeout(() => onChange(n), SETTLE_MS)
    return () => clearTimeout(t)
  }, [draft, value, onChange])

  const commit = () => {
    const n = parseBpm(draft)
    if (n === null) setDraft(String(value))
    else if (n !== value) onChange(n)
  }

  const invalid = parseBpm(draft) === null

  return (
    <input
      type="text"
      inputMode="numeric"
      aria-label="BPM"
      aria-invalid={invalid}
      title={`Whole number from ${MIN_BPM} to ${MAX_BPM}`}
      value={draft}
      onChange={(e) => setDraft(e.target.value)}
      onBlur={commit}
      onKeyDown={(e) => {
        if (e.key === 'Enter') {
          commit()
          e.currentTarget.blur()
        } else if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
          e.preventDefault()
          const next = Math.min(MAX_BPM, Math.max(MIN_BPM, value + (e.key === 'ArrowUp' ? 1 : -1)))
          setDraft(String(next))
          onChange(next)
        } else if (e.key === 'Escape') {
          setDraft(String(value))
        }
      }}
      style={{ width: 80, borderColor: invalid ? 'var(--wrong)' : undefined }}
    />
  )
}
