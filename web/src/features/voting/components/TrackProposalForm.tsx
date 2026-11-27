import type { TrackVoteState } from '../hooks/useTrackVote'

type Props = {
  state: TrackVoteState
  eventId: string
}

export default function TrackProposalForm({
  state, eventId
}: Props) {
  const {
    ranking, catalog, working,
    title, setTitle, artist, setArtist, propose
  } = state

  const available = catalog.filter(track =>
    !ranking.tracks.some(item =>
      item.title === track.title &&
      item.artist === track.artist
    )
  )

  const selected = available.find(track =>
    track.title === title && track.artist === artist
  )

  if (!ranking.canParticipate || ranking.finished) return null

  return (
    <form
      className="track-form"
      onSubmit={event => {
        if (!selected) {
          event.preventDefault()
          return
        }

        void propose(event)
      }}
    >
      <h4>Proposer un morceau</h4>

      <label htmlFor={`catalog-${eventId}`}>
        Catalogue audio
      </label>

      <select
        id={`catalog-${eventId}`}
        value={selected?.id ?? ''}
        required
        disabled={working}
        onChange={event => {
          const track = available.find(
            item => item.id === event.target.value
          )

          setTitle(track?.title ?? '')
          setArtist(track?.artist ?? '')
        }}
      >
        <option value="">Choisir un morceau</option>

        {available.map(track => (
          <option key={track.id} value={track.id}>
            {track.title} — {track.artist}{track.premium ? ' — Premium' : ''}
          </option>
        ))}
      </select>

      {available.length === 0 && (
        <p className="notice">
          Aucun nouveau morceau disponible.
        </p>
      )}

      <button
        type="submit"
        disabled={
          !selected ||
          working ||
          ranking.tracks.length >= 100
        }
      >
        {working ? 'Enregistrement...' : 'Proposer ce morceau'}
      </button>
    </form>
  )
}
