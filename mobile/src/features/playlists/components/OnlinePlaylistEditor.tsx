import { useState } from 'react'
import { ActivityIndicator } from 'react-native'
import { router } from 'expo-router'
import { canCreatePlaylist } from '../../../lib/musicPlaylists'
import { Screen } from '../../../ui/Screen'
import { Action, Notice } from '../../../ui/Controls'
import { theme } from '../../../ui/theme'
import { OfflinePlaylistEditor } from '../../offline/OfflinePlaylistEditor'
import type { PlaylistState } from '../hooks/usePlaylists'
import CreatePlaylistForm from './CreatePlaylistForm'
import PlaylistCard from './PlaylistCard'
import PlaylistSummary from './PlaylistSummary'

export default function OnlinePlaylistEditor({
  state
}: { state: PlaylistState }) {
  const {
    eventId,
    userId,
    view,
    listing,
    loading,
    busy,
    error,
    message,
    load
  } = state

  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)

  const selected = listing?.playlists.find(
    playlist => playlist.id === selectedId
  )

  const online = view?.source === 'server'

  if (!loading) {
    if (selectedId && (!online || !selected)) {
      setSelectedId(null)
    }

    if (creating && (!online || !listing || !canCreatePlaylist(listing))) {
      setCreating(false)
    }
  }

  function goBack() {
    if (selectedId || creating) {
      setSelectedId(null)
      setCreating(false)
      return
    }

    router.replace({
      pathname: '/event/[id]',
      params: { id: eventId }
    })
  }

  return (
    <Screen
      title={online
        ? selected?.title ?? (creating ? 'Nouvelle playlist' : 'Playlists')
        : 'Playlists'}
      subtitle="Morceaux et ordre de lecture des playlists."
    >
      <Action
        label={selectedId || creating
          ? 'Retour aux playlists'
          : 'Retour à la soirée'}
        secondary
        onPress={goBack}
      />

      {loading ? (
        <ActivityIndicator color={theme.primary} />
      ) : null}

      {error ? <Notice error>{error}</Notice> : null}
      {message ? <Notice>{message}</Notice> : null}

      {view?.source === 'cache' && !loading ? (
        <Notice>
          Mode hors ligne — modifications locales uniquement.
          Dernière synchronisation :
          {' '}{new Date(view.cachedAt).toLocaleString('fr-FR')}
        </Notice>
      ) : null}

      {!loading && !listing && !error ? (
        <Notice>Aucune donnée locale disponible ou cache expiré.</Notice>
      ) : null}

      <Action
        label="Actualiser les playlists"
        secondary
        disabled={loading || busy}
        onPress={() => { void load() }}
      />

      {view?.source === 'cache' && !loading ? (
        <OfflinePlaylistEditor
          key={`${userId}:${eventId}:${view.cachedAt}`}
          userId={userId}
          eventId={eventId}
          snapshot={view}
        />
      ) : null}

      {listing && !loading && online ? (
        <>
          {listing.finished ? (
            <Notice>
              La soirée est terminée.
              Les playlists sont en lecture seule.
            </Notice>
          ) : null}

          {!listing.finished && !listing.canEdit ? (
            <Notice>
              Tu peux consulter les playlists,
              mais pas les modifier.
            </Notice>
          ) : null}

          {creating && canCreatePlaylist(listing) ? (
            <CreatePlaylistForm state={state} />
          ) : selected ? (
            <PlaylistCard
              key={selected.id}
              state={state}
              playlist={selected}
            />
          ) : (
            <>
              {canCreatePlaylist(listing) ? (
                <Action
                  label="Créer une playlist"
                  disabled={busy || loading}
                  onPress={() => setCreating(true)}
                />
              ) : null}

              {listing.playlists.length === 0 ? (
                <Notice>
                  Aucune playlist pour cette soirée.
                </Notice>
              ) : null}

              {listing.playlists.map(playlist => (
                <PlaylistSummary
                  key={playlist.id}
                  playlist={playlist}
                  onPress={() => setSelectedId(playlist.id)}
                />
              ))}
            </>
          )}
        </>
      ) : null}
    </Screen>
  )
}
