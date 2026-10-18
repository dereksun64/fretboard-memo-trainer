import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { App } from './app/App'
import './app/tokens.css'
import './prototype/prototype.css'
import { installSimMic } from './dev/simMic'

// Dev only: ?sim swaps the mic for a synthetic one that tests can play into.
if (import.meta.env.DEV && new URLSearchParams(location.search).has('sim')) installSimMic()

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
