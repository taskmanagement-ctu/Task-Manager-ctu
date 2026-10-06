import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import './index.css';

// Register PWA Service Worker for app installability
if ('serviceWorker' in navigator && (window.location.protocol === 'https:' || window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')) {
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

