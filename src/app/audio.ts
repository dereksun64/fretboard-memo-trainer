// One shared AudioEngine, created on the first user gesture that needs it
// (browsers only allow audio + mic after a click).

import { AudioEngine } from '../audio/engine'

let pending: Promise<AudioEngine> | null = null

export function getAudioEngine(): Promise<AudioEngine> {
  if (!pending) {
    pending = AudioEngine.start().catch((e: unknown) => {
      pending = null
      throw new Error(micHelp(e))
    })
  }
  return pending
}

/** Turn getUserMedia failures into something a player can act on. */
function micHelp(e: unknown): string {
  if (typeof navigator === 'undefined' || !navigator.mediaDevices || !window.isSecureContext) {
    return 'This page needs a secure (https) connection to use the microphone.'
  }
  const name = e instanceof DOMException ? e.name : ''
  if (name === 'NotAllowedError' || name === 'SecurityError') {
    return 'Microphone access is blocked. Click the icon at the left of the address bar, allow the microphone for this site, then try again.'
  }
  if (name === 'NotFoundError' || name === 'OverconstrainedError') {
    return 'No microphone was found. Plug one in or enable your built-in mic, then try again.'
  }
  if (name === 'NotReadableError' || name === 'AbortError') {
    return 'The microphone is busy or unavailable. Close other apps using it (calls, recorders), then try again.'
  }
  return e instanceof Error ? e.message : String(e)
}
