import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initTheme } from './utils/theme';

// Restore the persisted accent theme before first paint (no flicker).
initTheme();

createRoot(document.getElementById('root')!).render(<App />);
