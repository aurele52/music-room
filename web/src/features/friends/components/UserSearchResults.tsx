import type { UserSearchState } from '../hooks/useUserSearch'

export default function UserSearchResults({
  state
}: { state: UserSearchState }) {
  const { users, searched, loading, openProfile } = state

  return (
    <>
      {searched && users.length === 0 && (
        <p className="notice">Aucun profil accessible trouvé.</p>
      )}

      {users.length > 0 && (
        <div className="user-search-results">
          <p className="notice">
            {users.length} résultat(s)
          </p>

          {users.map((user) => (
            <button
              type="button"
              className="user-search-result"
              key={user.id}
              disabled={loading}
              onClick={() => { void openProfile(user.id); }}
            >
              <strong>{user.name}</strong>
              <span>Voir le profil</span>
            </button>
          ))}
        </div>
      )}
    </>

  )
}
