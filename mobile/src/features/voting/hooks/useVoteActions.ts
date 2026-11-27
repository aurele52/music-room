import { errorMessage } from '../../../lib/api'
import { getVoteCoordinates } from '../../../lib/voteLocation'
import {
  changeMusicVote,
  mobileCanVote,
  proposeCatalogTrack
} from '../../../lib/musicActions'
import type { TrackVoteData } from './useTrackVoteData'

export function useVoteActions(data: TrackVoteData) {
  const {
    eventId,
    token,
    listing,
    loading,
    busy,
    setBusy,
    setError,
    setMessage,
    selectedTrack,
    setSelectedId,
    asyncFence,
    load
  } = data

  async function perform(
    operation: () => Promise<void>,
    onSuccess?: () => void
  ) {
    if (busy || loading || !listing || !token) return

    const scope = asyncFence.capture()
    const current = () => asyncFence.isCurrent(scope)

    setBusy(true)
    setError('')
    setMessage('')

    try {
      await operation()
      if (!current()) return

      onSuccess?.()
      await load()

      if (current()) {
        setMessage('Modification enregistrée.')
      }
    } catch (failure) {
      if (!current()) return
      setError(errorMessage(failure))
      // Le prochain rechargement actualisera les droits.
      // Ne pas masquer ici l'erreur initiale.
    } finally {
      if (current()) setBusy(false)
    }
  }

  function submitTrack() {
    if (!listing?.canParticipate || listing.finished) return

    if (!selectedTrack) {
      setError('Choisis un morceau disponible dans le catalogue.')
      return
    }

    void perform(
      () => proposeCatalogTrack(
        eventId,
        selectedTrack.id,
        token
      ),
      () => setSelectedId('')
    )
  }

  function toggleVote(
    trackId: string,
    currentlyVoted: boolean
  ) {
    if (!listing || !mobileCanVote(listing)) return

    const currentListing = listing

    void perform(async () => {
      // La permission GPS n'est demandée qu'au moment
      // d'un vote nécessitant une localisation.
      const coordinates = currentListing.requiresLocation
        ? await getVoteCoordinates()
        : undefined

      await changeMusicVote(
        trackId,
        currentlyVoted,
        currentListing,
        token,
        coordinates
      )
    })
  }


  return {
    submitTrack,
    toggleVote
  }
}
