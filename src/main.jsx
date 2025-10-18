import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import "@appwrite.io/pink-icons";
import App from './App.jsx'
import { AuthProvider } from '../apps/web/src/lib/auth'
import { initLiveRegions } from '../apps/web/src/lib/liveRegion'

// Initialize global live regions for accessible announcements
if (typeof document !== 'undefined') {
  initLiveRegions();
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <App />
    </AuthProvider>
  </StrictMode>,
)
