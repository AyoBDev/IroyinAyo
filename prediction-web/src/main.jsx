import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { initTheme } from './theme.js';
import './styles/global.css';

initTheme();

createRoot(document.getElementById('root')).render(<App />);
