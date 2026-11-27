import Events from '../features/events/Events';
import type { Auth } from '../features/auth/useAuth';

export default function EventsPage({ auth }: { auth: Auth }) {
  return (
    <>
      <h1>Mes événements</h1>
      <Events
        token={auth.token}
        onAuthError={auth.handleProtectedError}
      />
    </>
  );
}
