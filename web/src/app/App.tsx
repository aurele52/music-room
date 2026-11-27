import { useAuth } from '../features/auth/useAuth';
import AuthPage from '../features/auth/AuthPage';
import AppLayout from './AppLayout';
import { useNavigation } from './useNavigation';

import HomePage from '../pages/HomePage';
import EventsPage from '../pages/EventsPage';
import DiscoveryPage from '../pages/DiscoveryPage';
import FriendsPage from '../pages/FriendsPage';
import ProfilePage from '../pages/ProfilePage';
import SettingsPage from '../pages/SettingsPage';

import '../styles/layout.css';

export default function App() {
  const auth = useAuth();
  const { page, navigate } = useNavigation();

  if (auth.checking) {
    return (
      <main className="card">
        <div className="brand">♫ Music Room</div>
        <p>Chargement...</p>
      </main>
    );
  }

  if (!auth.user || auth.mode === 'verify' || auth.mode === 'reset') {
    return <AuthPage auth={auth} />;
  }

  return (
    <AppLayout
      page={page}
      navigate={navigate}
      name={auth.user.name}
      logout={() => {
        navigate('home');
        auth.logout();
      }}
    >
      {auth.error && (
        <p className="error" role="alert">{auth.error}</p>
      )}

      <div key={auth.token}>
        {page === 'home' && (
          <HomePage name={auth.user.name} navigate={navigate} />
        )}

        {page === 'events' && <EventsPage auth={auth} />}
        {page === 'discovery' && <DiscoveryPage auth={auth} />}
        {page === 'friends' && <FriendsPage auth={auth} />}
        {page === 'profile' && <ProfilePage auth={auth} />}
        {page === 'settings' && <SettingsPage auth={auth} />}
      </div>
    </AppLayout>
  );
}
