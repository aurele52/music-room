import type { FriendsState } from '../hooks/useFriends'


export default function ReceivedRequests({
  state
}: { state: FriendsState }) {
  const { lists, busy, performAction } = state

  return (
    <>
      <h3>Demandes reçues ({lists.incoming.length})</h3>

      {lists.incoming.length === 0 && (
        <p className="notice">Aucune demande reçue.</p>
      )}

      {lists.incoming.map((item) => (
        <div className="friend-item" key={item.id}>
          <strong>{item.user.name}</strong>

          <div className="friend-actions">
            <button
              type="button"
              disabled={busy}
              onClick={() => {
                void performAction(
                  item.id,
                  `/friends/requests/${item.id}/accept`,
                  'POST',
                  'Invitation acceptée.'
                )
              }}
            >
              Accepter
            </button>

            <button
              type="button"
              className="secondary"
              disabled={busy}
              onClick={() => {
                void performAction(
                  item.id,
                  `/friends/requests/${item.id}`,
                  'DELETE',
                  'Invitation refusée.'
                )
              }}
            >
              Refuser
            </button>
          </div>
        </div>
      ))}
    </>

  )
}
