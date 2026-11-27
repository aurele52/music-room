import { Alert } from 'react-native'
import {
  canCreatePlaylist,
  createMusicPlaylist,
  updatePlaylistPermissions,
  type PlaylistPermissions
} from '../../../lib/musicPlaylists'
import {
  addMusicPlaylistItem,
  canDeleteMusicPlaylist,
  canManagePlaylistItems,
  canEditPlaylistItems,
  canChangePlaylistPermissions,
  deleteMusicPlaylist,
  moveMusicPlaylistItem,
  removeMusicPlaylistItem,
  type PlaylistItemDraft
} from '../../../lib/musicPlaylistActions'
import { errorMessage } from '../../../lib/api'
import { isCurrentSession } from '../../../session/SessionProvider'
import type { PlaylistData } from './usePlaylistData'

export function usePlaylistActions(data: PlaylistData) {
  const {
    session,
    token,
    eventId,
    view,
    listing,
    title,
    setTitle,
    description,
    setDescription,
    drafts,
    setDrafts,
    loading,
    busy,
    setBusy,
    setError,
    setMessage,
    asyncFence,
    load
  } = data

  async function perform(
    operation: () => Promise<void>,
    successMessage: string,
    onSuccess?: () => void
  ) {
    if (
      busy || loading || !listing || !token ||
      view?.source !== 'server' ||
      !isCurrentSession(session)
    ) return

    const scope = asyncFence.capture()
    const current = () =>
      isCurrentSession(session) &&
      asyncFence.isCurrent(scope)

    setBusy(true)
    setError('')
    setMessage('')

    try {
      await operation()
      if (!current()) return

      onSuccess?.()

      const refreshed = await load()

      if (current() && refreshed) {
        setMessage(successMessage)
      }
    } catch (failure) {
      if (!current()) return

      const reason = errorMessage(failure)

      // Relecture indispensable après conflit de révision
      // ou changement de permissions côté serveur.
      await load()
      if (current()) setError(reason)
    } finally {
      if (current()) setBusy(false)
    }
  }

  function createPlaylist() {
    if (
      !listing ||
      !canCreatePlaylist(listing)
    ) return

    void perform(
      () => createMusicPlaylist(
        eventId,
        { title, description },
        token
      ),
      'Playlist créée.',
      () => {
        setTitle('')
        setDescription('')
      }
    )
  }

  function updateDraft(
    id: string,
    field: keyof PlaylistItemDraft,
    value: string
  ) {
    setDrafts(previous => ({
      ...previous,
      [id]: {
        title: previous[id]?.title ?? '',
        artist: previous[id]?.artist ?? '',
        [field]: value
      }
    }))
  }

  function addItem(playlistId: string) {
    if (
      !listing ||
      !canEditPlaylistItems(listing, playlistId)
    ) return

    const draft = drafts[playlistId] ?? {
      title: '',
      artist: ''
    }

    void perform(
      () => addMusicPlaylistItem(
        playlistId,
        draft,
        token
      ),
      'Morceau ajouté.',
      () => setDrafts(previous => ({
        ...previous,
        [playlistId]: { title: '', artist: '' }
      }))
    )
  }

  function confirmRemoveItem(
    playlistId: string,
    itemId: string,
    itemTitle: string
  ) {
    if (
      !listing ||
      !canEditPlaylistItems(listing, playlistId) ||
      busy
    ) return

    const confirmation = asyncFence.capture()

    Alert.alert(
      'Retirer le morceau',
      `Retirer « ${itemTitle} » de cette playlist ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Retirer',
          style: 'destructive',
          onPress: () => {
            if (
              !isCurrentSession(session) ||
              !asyncFence.isCurrent(confirmation)
            ) return

            void perform(
              () => removeMusicPlaylistItem(
                playlistId,
                itemId,
                token
              ),
              'Morceau retiré.'
            )
          }
        }
      ]
    )
  }

  function confirmDeletePlaylist(
    playlistId: string,
    playlistTitle: string
  ) {
    if (
      !listing ||
      !canDeleteMusicPlaylist(listing) ||
      busy
    ) return

    const confirmation = asyncFence.capture()

    Alert.alert(
      'Supprimer la playlist',
      `Supprimer définitivement « ${playlistTitle} » et ses morceaux ?`,
      [
        { text: 'Annuler', style: 'cancel' },
        {
          text: 'Supprimer',
          style: 'destructive',
          onPress: () => {
            if (
              !isCurrentSession(session) ||
              !asyncFence.isCurrent(confirmation)
            ) return

            void perform(
              () => deleteMusicPlaylist(
                playlistId,
                token
              ),
              'Playlist supprimée.'
            )
          }
        }
      ]
    )
  }

  function moveItem(
    playlistId: string,
    itemId: string,
    direction: -1 | 1
  ) {
    if (
      !listing ||
      !canEditPlaylistItems(listing, playlistId)
    ) return

    const playlist = listing.playlists.find(
      candidate => candidate.id === playlistId
    )

    if (!playlist) return

    void perform(
      () => moveMusicPlaylistItem(
        playlist,
        itemId,
        direction,
        token
      ),
      'Ordre enregistré.'
    )
  }

  function changePermissions(
    playlistId: string,
    permissions: PlaylistPermissions
  ) {
    if (
      !listing ||
      !canChangePlaylistPermissions(listing, playlistId)
    ) return

    void perform(
      () => updatePlaylistPermissions(
        playlistId,
        permissions,
        token
      ),
      'Permissions actualisées.'
    )
  }

  const editable = listing
    ? canManagePlaylistItems(listing)
    : false


  return {
    editable,
    changePermissions,
    createPlaylist,
    updateDraft,
    addItem,
    confirmRemoveItem,
    confirmDeletePlaylist,
    moveItem
  }
}
