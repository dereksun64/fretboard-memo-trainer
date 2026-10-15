// Batches mic samples into blocks stamped with their exact start frame,
// so the main thread can time note onsets against the metronome clock.

const BLOCK = 512

class CaptureProcessor extends AudioWorkletProcessor {
  constructor() {
    super()
    this.buf = new Float32Array(BLOCK)
    this.n = 0
    this.start = 0
  }

  process(inputs) {
    const ch = inputs[0] && inputs[0][0]
    if (!ch) return true
    for (let i = 0; i < ch.length; i++) {
      if (this.n === 0) this.start = currentFrame + i
      this.buf[this.n++] = ch[i]
      if (this.n === BLOCK) {
        this.port.postMessage({ frame: this.start, samples: this.buf }, [this.buf.buffer])
        this.buf = new Float32Array(BLOCK)
        this.n = 0
      }
    }
    return true
  }
}

registerProcessor('capture', CaptureProcessor)
