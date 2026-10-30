import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Si Lumiere estaba abierta desde antes de una actualización, al usar algo que se carga aparte (PDF, imagen, etc.)
// busca un archivo de la versión vieja que ya no existe. En ese caso se recarga sola una vez y queda la versión nueva.
window.addEventListener('vite:preloadError', (e) => {
  let ultima = 0
  try { ultima = Number(sessionStorage.getItem('lumiere_recarga_version') || 0) } catch (x) { /* sin storage */ }
  if (Date.now() - ultima < 30000) return
  e.preventDefault()
  try { sessionStorage.setItem('lumiere_recarga_version', String(Date.now())) } catch (x) { /* sin storage */ }
  alert('Hay una versión nueva de Lumiere. Se va a recargar la página: después volvé a tocar el botón.')
  // Mientras recarga, que no salga además el cartel de error de lo que se estaba haciendo
  window.alert = () => {}
  window.location.reload()
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
