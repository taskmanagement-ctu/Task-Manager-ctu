import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Manage PWA Service Worker: only register in production builds.
// In development, automatically unregister any stale service workers to prevent intercepting Vite dev server requests.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').then(
        (reg) => {
          console.log('PWA ServiceWorker registered with scope:', reg.scope);
        },
        (err) => {
          console.error('PWA ServiceWorker registration failed:', err);
        }
      );
    });
  } else {
    // In development mode, automatically unregister any active service worker from localhost
    navigator.serviceWorker.getRegistrations().then((registrations) => {
      for (const registration of registrations) {
        registration.unregister();
      }
    }).catch(() => {});
  }
}

// Suppress third-party browser extension / performance observer errors (e.g., reportAllChanges / reading 'startTime')
window.addEventListener('error', (event) => {
  if (
    event.message?.includes('startTime') ||
    event.error?.stack?.includes('reportAllChanges') ||
    (event.filename && event.filename.includes('anonymous'))
  ) {
    event.preventDefault();
    event.stopPropagation();
    return true;
  }
});

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

