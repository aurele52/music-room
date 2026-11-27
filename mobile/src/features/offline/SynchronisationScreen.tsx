import { Redirect } from 'expo-router'
import { useSession } from '../../session/SessionProvider'
import { Screen } from '../../ui/Screen'
import { Notice } from '../../ui/Controls'
import { useSynchronisation } from './hooks/useSynchronisation'
import type {
  SynchronisationProps
} from './hooks/useSynchronisationData'
import SynchronisationView from './components/SynchronisationContent'

function SynchronisationContent(
  props: SynchronisationProps
) {
  const state = useSynchronisation(props)

  return <SynchronisationView state={state} />
}

export default function Synchronisation() {
  const { session } = useSession()

  if (session.status === 'loading') {
    return (
      <Screen title="Synchronisation">
        <Notice>Chargement de la session…</Notice>
      </Screen>
    )
  }

  if (session.status === 'authenticated') {
    return (
      <SynchronisationContent
        key={session.token}
        scope={session}
        userId={session.user.id}
        token={session.token}
      />
    )
  }

  if (
    session.status === 'error' &&
    session.offlineUserId
  ) {
    return (
      <SynchronisationContent
        key={session.offlineUserId}
        scope={session}
        userId={session.offlineUserId}
        token={null}
      />
    )
  }

  return <Redirect href="/" />
}
