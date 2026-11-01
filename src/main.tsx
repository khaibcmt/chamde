import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';

(window as unknown as { __EDU_CHAM_DE_MOUNTED__?: boolean }).__EDU_CHAM_DE_MOUNTED__ = true;

createRoot(document.getElementById('root')!).render(<App />);
