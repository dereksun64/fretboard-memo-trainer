import { useEffect, useState } from 'react'

const FALLBACK_MS = 100

/**
 * Re-render every animation frame while `active`, returning `read()`'s value.
 * Browsers pause requestAnimationFrame in hidden tabs, so a slow timer keeps
 * ticking whenever frames stop arriving; a run still gets judged and
 * finished even if the window is in the background.
 */
export function useFrameValue<T>(read: () => T, active = true): T {
  const [, setTick] = useState(0)
  useEffect(() => {
    if (!active) return
    let raf = 0
    let lastFrame = performance.now()
    const tick = () => setTick((n) => n + 1)
    const loop = () => {
      lastFrame = performance.now()
      tick()
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    const timer = setInterval(() => {
      if (performance.now() - lastFrame > FALLBACK_MS * 2) tick()
    }, FALLBACK_MS)
    return () => {
      cancelAnimationFrame(raf)
      clearInterval(timer)
    }
  }, [active])
  return read()
}
