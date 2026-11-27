import React from 'react';
import ReactDOM from 'react-dom/client';
import { GoogleOAuthProvider } from '@react-oauth/google';
import App from './app/App';
import { EventDeepLink } from './features/events/sharing/EventQuickAccess';
import './styles/global.css';
import './styles/forms.css';
import './styles/buttons.css';
import './styles/common.css';
import './styles/auth.css';
import './styles/profile.css';
import './styles/friends.css';
import './styles/eventForms.css';
import './styles/playlists.css';
import './styles/sharing.css';
import './styles/permissions.css';
import './styles/events.css';

const clientId = import.meta.env.VITE_GOOGLE_CLIENT_ID;

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    {clientId ? (
      <GoogleOAuthProvider clientId={clientId}>
        <App />
        <EventDeepLink />
      </GoogleOAuthProvider>
    ) : (
      <main className="card">
        <h1>Music Room</h1>
        <p>Configuration Google manquante.</p>
        <p>Vérifie VITE_GOOGLE_CLIENT_ID dans web/.env.</p>
      </main>
    )}
  </React.StrictMode>
);
