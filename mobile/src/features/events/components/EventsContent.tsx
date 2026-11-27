import { ActivityIndicator } from 'react-native'
import { Screen } from '../../../ui/Screen'
import { Action, Notice } from '../../../ui/Controls'
import { theme } from '../../../ui/theme'
import type { EventsState } from '../hooks/useEvents'
import EventList from './EventList'
import EventSearch from './EventSearch'
import EventNavigation from './EventNavigation'

export default function EventsContent({
  state
}: { state: EventsState }) {
  const {
    events,
    mine,
    query,
    setQuery,
    activeQuery,
    setActiveQuery,
    loading,
    error,
    load,
    logout
  } = state

  return (
    <Screen
      title="Événements"
      subtitle="Découvre les soirées publiques et retrouve les tiennes."
    >


      <EventNavigation />

      <EventSearch
        query={query}
        setQuery={setQuery}
        setActiveQuery={setActiveQuery}
      />

      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : null}
      {error ? (
        <>
          <Notice error>{error}</Notice>
          <Action
            label="Réessayer"
            secondary
            onPress={() => { void load(activeQuery) }}
          />
        </>
      ) : null}


      <EventList
        title="Événements publics"
        events={events}
        loading={loading}
        emptyMessage="Aucun événement trouvé."
      />

      <EventList
        title="Mes événements organisés"
        events={mine}
        loading={loading}
        emptyMessage="Tu n’organises pas encore d’événement."
      />

      <Action
        label="Se déconnecter"
        secondary
        onPress={() => { void logout() }}
      />
    </Screen>
  )
}
