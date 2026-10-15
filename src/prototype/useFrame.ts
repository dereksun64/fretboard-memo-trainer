import { useEffect, useState } from 'react'

/** Re-render the calling component on every animation frame. */
export function useFrame(): void {
  const [, setTick] = useState(0)
  useEffect(() => {
    let id = 0
    const loop = () => {
      setTick((n) => n + 1)
      id = requestAnimationFrame(loop)
    }
    id = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(id)
  }, [])
}
