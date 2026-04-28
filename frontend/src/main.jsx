import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import App from './App.jsx';
import { AuthProvider } from './context/AuthContext.jsx';
import './index.css';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <AuthProvider>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            duration: 4000,
            style: {
              fontFamily: "'Bricolage Grotesque', sans-serif",
              fontSize: '14px',
              borderRadius: '12px',
              background: '#1C2126',
              color: '#fff',
              border: '1px solid rgba(201,168,76,0.2)',
            },
            success: { iconTheme: { primary: '#C9A84C', secondary: '#0F1214' } },
            error: { iconTheme: { primary: '#D94545', secondary: '#fff' } },
          }}
        />
      </AuthProvider>
    </BrowserRouter>
  </React.StrictMode>
);
