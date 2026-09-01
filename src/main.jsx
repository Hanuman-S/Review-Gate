// Must be first: installs a dev-only document.modelContext before any module
// reads it. Stripped from production builds.
import './dev-polyfill.js';

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import './index.css';

createRoot(document.getElementById('root')).render(
  <StrictMode><App /></StrictMode>,
);
