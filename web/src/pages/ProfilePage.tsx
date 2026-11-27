import ProfileDetails from '../features/profile/ProfileDetails';
import ProfileInformation from '../features/profile/ProfileInformation';
import type { Auth } from '../features/auth/useAuth';

export default function ProfilePage({ auth }: { auth: Auth }) {
  return (
    <>
      <h1>Mon profil</h1>
      <ProfileDetails auth={auth} />
      <ProfileInformation
        key={auth.token}
        request={auth.protectedRequest}
        onAuthError={auth.handleProtectedError}
      />
    </>
  );
}
