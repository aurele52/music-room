import type { UserSearchState } from '../hooks/useUserSearch'

export default function UserSearchForm({
  state
}: { state: UserSearchState }) {
  const { query, setQuery, loading, search } = state

  return (
    <form className="user-search-form" onSubmit={search}>
      <label htmlFor="user-search-query">
        Nom de l'utilisateur
      </label>

      <input
        id="user-search-query"
        type="search"
        value={query}
        onChange={(event) => setQuery(event.target.value)}
        placeholder="Rechercher un nom..."
        maxLength={50}
        disabled={loading}
      />

      <button
        type="submit"
        disabled={loading || query.trim().length < 2}
      >
        {loading ? 'Recherche...' : 'Rechercher'}
      </button>
    </form>

  )
}
