import type { UserSearchState } from '../hooks/useUserSearch'

export default function UserProfile({
  state
}: { state: UserSearchState }) {
  const {
    selected, setSelected, loading,
    inviting, invitedIds, inviteUser
  } = state

  if (!selected) return null

  return (
    <div className="user-search-detail">
      <h3>{selected.name}</h3>

      <p>
        Inscrit depuis le{' '}
        {new Date(selected.createdAt).toLocaleDateString('fr-FR')}
      </p>

      <p>
        {selected.visibility === 'PUBLIC'
          ? 'Profil public'
          : 'Profil réservé aux amis'}
      </p>

      {selected.publicBio && (
        <p>{selected.publicBio}</p>
      )}

      {selected.friendsBio && (
        <>
          <h4>Informations réservées aux amis</h4>
          <p>{selected.friendsBio}</p>
        </>
      )}

      <button
        type="button"
        disabled={
          loading ||
          inviting ||
          invitedIds.includes(selected.id)
        }
        onClick={() => {
          void inviteUser(selected.id);
        }}
      >
        {invitedIds.includes(selected.id)
          ? 'Demande envoyée'
          : inviting
            ? 'Envoi...'
            : 'Ajouter en ami'}
      </button>

      <button
        type="button"
        className="secondary"
        onClick={() => setSelected(null)}
      >
        Fermer le profil
      </button>
    </div>

  )
}
