import { ActivityIndicator } from 'react-native'
import { Authenticated } from '../auth/Authenticated'
import { useEvents } from '../events/hooks/useEvents'
import EventSearch from '../events/components/EventSearch'
import EventList from '../events/components/EventList'
import { Screen } from '../../ui/Screen'
import { Action, Notice } from '../../ui/Controls'
import { theme } from '../../ui/theme'

function DiscoverContent() {
  const {
    events,
    query,
    setQuery,
    activeQuery,
    setActiveQuery,
    loading,
    error,
    load
  } = useEvents()

  return (
    <Screen
      title="Découvrir"
      subtitle="Trouve des événements musicaux publics."
    >
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
    </Screen>
  )
}

export default function DiscoverScreen() {
  return (
    <Authenticated>
      <DiscoverContent />
    </Authenticated>
  )
}
