// Small UI sounds, played straight to the speakers on the shared AudioContext.

/** A light "bwomp": a soft triangle tone sliding down, about 0.25 s. */
export function playMissSound(ctx: AudioContext) {
  const t = ctx.currentTime + 0.01
  const osc = ctx.createOscillator()
  osc.type = 'triangle'
  osc.frequency.setValueAtTime(330, t)
  osc.frequency.exponentialRampToValueAtTime(165, t + 0.22)
  const gain = ctx.createGain()
  gain.gain.setValueAtTime(0.0001, t)
  gain.gain.exponentialRampToValueAtTime(0.14, t + 0.015)
  gain.gain.exponentialRampToValueAtTime(0.0001, t + 0.26)
  osc.connect(gain).connect(ctx.destination)
  osc.start(t)
  osc.stop(t + 0.28)
}
