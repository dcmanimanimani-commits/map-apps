import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

/** iPhoneなどブラウザUIで高さが変わる端末向けに表示領域を同期 */
function syncAppHeight() {
  const h = window.visualViewport?.height ?? window.innerHeight
  document.documentElement.style.setProperty('--app-height', `${Math.round(h)}px`)
}

syncAppHeight()
window.addEventListener('resize', syncAppHeight)
window.visualViewport?.addEventListener('resize', syncAppHeight)
window.visualViewport?.addEventListener('scroll', syncAppHeight)

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
