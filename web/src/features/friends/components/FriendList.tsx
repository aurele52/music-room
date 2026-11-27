import type { FriendsState } from '../hooks/useFriends'


export default function FriendList({
  state
}: { state: FriendsState }) {
  const { lists, busy, performAction } = state

  return (
    <>
      <h3>Amis ({lists.friends.length})</h3>

      {lists.friends.length === 0 && (
        <p className="notice">
          Tu n'as pas encore d'amis sur Music Room.
        </p>
      )}

      {lists.friends.map((item) => (
        <div className="friend-item" key={item.id}>
          <strong>{item.user.name}</strong>

          <button
            type="button"
            className="secondary"
            disabled={busy}
            onClick={() => {
              void performAction(
                item.id,
                `/friends/${item.user.id}`,
                'DELETE',
                'Ami supprimé.'
              )
            }}
          >
            Supprimer
          </button>
        </div>
      ))}
    </>

  )
}
