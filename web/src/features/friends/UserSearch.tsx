import { useUserSearch } from './hooks/useUserSearch'
import UserSearchForm from './components/UserSearchForm'
import UserSearchResults from './components/UserSearchResults'
import UserProfile from './components/UserProfile'
import type { Props } from './searchTypes'

export default function UserSearch(props: Props) {
  const state = useUserSearch(props)
  const { selected, error, message } = state

  return (
    <section className="profile">
      <h2>Rechercher des utilisateurs</h2>

      {error && <p className="error" role="alert">{error}</p>}
      {message && <p className="success" role="status">{message}</p>}

      {selected ? (
        <UserProfile state={state} />
      ) : (
        <>
          <UserSearchForm state={state} />
          <UserSearchResults state={state} />
        </>
      )}
    </section>
  )
}
