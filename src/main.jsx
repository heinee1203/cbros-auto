import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'
import FirebaseSyncProvider from './providers/FirebaseSyncProvider.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <FirebaseSyncProvider>
      <App />
    </FirebaseSyncProvider>
  </StrictMode>,
)
