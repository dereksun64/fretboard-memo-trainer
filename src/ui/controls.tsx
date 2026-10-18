// Run-screen controls shared by Basics and the exercises.

/** Start / Stop in one fixed-width button, on Space. */
export function StartStop({ started, onToggle }: { started: boolean; onToggle: () => void }) {
  return (
    <button type="button" className={`btn start-stop ${started ? '' : 'primary'}`} onClick={onToggle}>
      {started ? 'Stop' : 'Start'} <span className="label muted">Space</span>
    </button>
  )
}

/** "Press Space to start", pulsing gently until the run starts. */
export function StartHint() {
  return (
    <span className="start-hint">
      Press <kbd>Space</kbd> to start
    </span>
  )
}
