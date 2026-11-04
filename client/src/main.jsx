import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

// Bind dynamic viewport height to --app-height so Android on-screen keyboard
// resizes the layout without displacing the header or causing an empty void
function syncViewportHeight() {
  const h = window.visualViewport ? window.visualViewport.height : window.innerHeight;
  document.documentElement.style.setProperty('--app-height', `${h}px`);
  if (window.scrollY !== 0) window.scrollTo(0, 0);
  if (document.body && document.body.scrollTop !== 0) document.body.scrollTop = 0;
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', syncViewportHeight);
  window.visualViewport.addEventListener('scroll', () => {
    if (window.scrollY !== 0) window.scrollTo(0, 0);
  });
}
window.addEventListener('resize', syncViewportHeight);
window.addEventListener('scroll', () => {
  if (window.scrollY !== 0) window.scrollTo(0, 0);
});
syncViewportHeight();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
