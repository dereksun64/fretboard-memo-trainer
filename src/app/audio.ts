// One shared AudioEngine, created on the first user gesture that needs it
// (browsers only allow audio + mic after a click).

import { AudioEngine } from '../audio/engine'

let pending: Promise<AudioEngine> | null = null

export function getAudioEngine(): Promise<AudioEngine> {
  if (!pending) {
    pending = AudioEngine.start().catch((e: unknown) => {
      pending = null
      throw e
    })
  }
  return pending
}
