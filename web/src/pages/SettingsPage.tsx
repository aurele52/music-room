import SubscriptionSettings from '../features/subscription/SubscriptionSettings';
import MusicPreferences from '../features/profile/MusicPreferences';
import PrivacySettings from '../features/profile/PrivacySettings';
import GoogleAccount from '../features/profile/GoogleAccount';
import type { Auth } from '../features/auth/useAuth';

export default function SettingsPage({ auth }: { auth: Auth }) {
  return (
    <>
      <h1>Paramètres</h1>
      <SubscriptionSettings key={auth.token} auth={auth} />
      <MusicPreferences auth={auth} />
      <PrivacySettings auth={auth} />
      <GoogleAccount auth={auth} />
    </>
  );
}
