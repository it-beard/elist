import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import ErrorBoundary from './components/ErrorBoundary.jsx';
import { LangProvider } from './hooks/useLang.jsx';
import { takeEntryQuery } from './lib/entry.js';
import './styles.css';

// Запыт з уваходнай спасылкі (?q= / #q=) → history.state, а адрас ачышчаецца яшчэ да таго,
// як React прачытае location: у адрасным радку і гісторыі браўзера запыт не застаецца.
takeEntryQuery();

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <LangProvider>
      <ErrorBoundary>
        <App />
      </ErrorBoundary>
    </LangProvider>
  </StrictMode>,
);

// Афлайн-рэжым: service worker кэшуе абалонку сайта і базу (толькі ў production-зборцы).
if ('serviceWorker' in navigator && import.meta.env.PROD) {
  addEventListener('load', () => {
    navigator.serviceWorker.register(`${import.meta.env.BASE_URL}sw.js`).catch(() => {});
  });
}
