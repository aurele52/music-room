import SubscriptionSettings from '../../subscription/SubscriptionSettings'
import { Screen } from '../../../ui/Screen'
import { Action, Notice } from '../../../ui/Controls'
import type { ProfileState } from '../hooks/useProfile'
import ProfileIdentity from './ProfileIdentity'
import ProfileVisibility from './ProfileVisibility'
import ProfileInformation from './ProfileInformation'
import MusicPreferences from './MusicPreferences'
import ProfileAccountActions from './ProfileAccountActions'

export default function ProfileContent({
  state
}: { state: ProfileState }) {
  const {
    session,
    token,
    loading,
    ready,
    error,
    message,
    retry
  } = state

  if (session.status !== 'authenticated') return null

  return (
    <Screen
      title="Mon profil"
      subtitle={session.user.email}
    >
      {token ? (
        <SubscriptionSettings key={token} token={token} />
      ) : null}


      {loading ? (
        <Notice>Chargement du profil…</Notice>
      ) : !ready ? (
        <Action
          label="Réessayer"
          secondary
          onPress={retry}
        />
      ) : (
        <>
          <ProfileIdentity state={state} />
          <ProfileVisibility state={state} />
          <ProfileInformation state={state} />
          <MusicPreferences state={state} />
        </>
      )}

      {error ? <Notice error>{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}


      <ProfileAccountActions state={state} />

    </Screen>
  )
}
