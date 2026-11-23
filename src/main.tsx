import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './app/App';
import './ui/theme/tokens.css';
import './app/global.css';
import { applyTheme, readStoredTheme } from './ui/theme/theme';

applyTheme(readStoredTheme());

const root = document.getElementById('root');
if (!root) throw new Error('#root element missing from index.html');

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
