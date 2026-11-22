import { createRoot } from 'react-dom/client';
import './styles/tokens.css';
import './styles/win95.css';
import { App } from './App';
import { AppErrorBoundary } from './components/AppErrorBoundary';

createRoot(document.getElementById('root')!).render(
  <AppErrorBoundary>
    <App />
  </AppErrorBoundary>,
);
