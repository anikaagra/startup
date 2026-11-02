import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { BrowserRouter, MemoryRouter } from 'react-router-dom';
import './styles/tokens.css';
import './styles/components.css';
import './styles/app.css';
import { App } from './App';

// The shareable demo runs inside a frame that can't use URL paths, so it keeps routes in memory.
const Router = import.meta.env.VITE_DEMO === '1' ? MemoryRouter : BrowserRouter;

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Router>
      <App />
    </Router>
  </StrictMode>,
);
