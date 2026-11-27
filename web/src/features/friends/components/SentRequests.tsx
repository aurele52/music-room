import type { FriendsState } from '../hooks/useFriends'


export default function SentRequests({
  state
}: { state: FriendsState }) {
  const { lists, busy, performAction } = state

  return (
    <>
      <h3>Demandes envoyées ({lists.outgoing.length})</h3>

      {lists.outgoing.length === 0 && (
        <p className="notice">Aucune demande en attente.</p>
      )}

      {lists.outgoing.map((item) => (
        <div className="friend-item" key={item.id}>
          <strong>{item.user.name}</strong>

          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              void performAction(
                item.id,
                `/friends/requests/${item.id}`,
                'DELETE',
                'Invitation annulée.'
              )
            }}
          >
            Annuler
          </button>
        </div>
      ))}
    </>

  )
}
