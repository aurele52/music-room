import EventDiscovery from '../features/events/discovery/EventDiscovery';
import type { Auth } from '../features/auth/useAuth';

export default function DiscoveryPage({ auth }: { auth: Auth }) {
  return (
    <>
      <h1>Découvrir</h1>
      <EventDiscovery
        token={auth.token}
        onAuthError={auth.handleProtectedError}
      />
    </>
  );
}
