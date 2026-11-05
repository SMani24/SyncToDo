import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.jsx';

function resetDocumentScroll() {
  if (window.scrollY !== 0) window.scrollTo(0, 0);
  if (document.body && document.body.scrollTop !== 0) document.body.scrollTop = 0;
  if (document.documentElement && document.documentElement.scrollTop !== 0) document.documentElement.scrollTop = 0;
}

if (window.visualViewport) {
  window.visualViewport.addEventListener('resize', resetDocumentScroll);
  window.visualViewport.addEventListener('scroll', resetDocumentScroll);
}
window.addEventListener('resize', resetDocumentScroll);
window.addEventListener('scroll', resetDocumentScroll);
resetDocumentScroll();

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>
);
