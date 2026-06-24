import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { registerServiceWorker, listenToServiceWorkerMessages } from './utils/serviceWorkerRegistration'
import './i18n'

// Register service worker for offline support
registerServiceWorker().then((result) => {
  if (result.success) {
    console.log('[Main] Service worker registered successfully');

    // Listen for service worker messages
    const cleanup = listenToServiceWorkerMessages((message) => {
      console.log('[Main] Message from service worker:', message);

      // Handle connectivity status updates
      if (message.type === 'CONNECTIVITY_STATUS') {
        console.log('[Main] Connectivity status changed:', message.isOnline);
        // You can dispatch this to React state management here if needed
      }
    });

    // Cleanup on page unload
    window.addEventListener('beforeunload', cleanup);
  } else {
    console.warn('[Main] Service worker registration failed:', result.error);
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
