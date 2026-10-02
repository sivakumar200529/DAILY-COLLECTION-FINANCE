import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App.tsx';
import './index.css';

import { ThemeProvider } from './context/ThemeContext';
import { LanguageProvider } from './context/LanguageContext';
import { ConfigProvider } from './context/ConfigContext';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <ThemeProvider>
      <LanguageProvider>
        <ConfigProvider>
          <App />
        </ConfigProvider>
      </LanguageProvider>
    </ThemeProvider>
  </React.StrictMode>,
);
