/// <reference types="vite/client" />
// SECURITY: Global Privacy Hardening
// Disable console logging outputs IN PRODUCTION to prevent Accidental PII Leakage.
// We keep console.warn and console.error functional for troubleshooting.
if (import.meta.env.PROD) {
  const noop = () => { };
  console.log = noop;
  console.info = noop;
  console.debug = noop;
  console.table = noop;
}


import React from 'react';
import ReactDOM from 'react-dom/client';
import App from './App';
import { initNativeAppStyles } from './src/utils/capacitor-utils';

// Initialize native app CSS classes for Capacitor
initNativeAppStyles();

const rootElement = document.getElementById('root');
if (!rootElement) {
  throw new Error("Could not find root element to mount to");
}

import { BrowserRouter } from 'react-router-dom';

import { AuthProvider } from './src/context/AuthContext';
import { DataProvider } from './src/contexts/DataContext';
import { NotificationProvider } from './src/contexts/NotificationContext';

import { Toaster } from 'react-hot-toast';

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <AuthProvider>
      <DataProvider>
        <NotificationProvider>
          <BrowserRouter>
            <App />
            <Toaster position="top-right" />
          </BrowserRouter>
        </NotificationProvider>
      </DataProvider>
    </AuthProvider>
  </React.StrictMode>
);
