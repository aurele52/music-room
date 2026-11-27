import { Text } from 'react-native'
import { Action, Notice } from '../../../ui/Controls'
import { theme } from '../../../ui/theme'
import type { ParticipationState } from '../hooks/useEventParticipation'

export default function EventInvitationForm({
  state
}: { state: ParticipationState }) {
  const {
    friends,
    friendId,
    setFriendId,
    friendsLoading,
    friendsError,
    selectedFriend,
    busy,
    inviteFriend
  } = state

  return (
    <>
      <Text style={{
        color: theme.primary,
        fontWeight: '700'
      }}>
        Inviter un ami confirmé
      </Text>

      {friendsLoading ? (
        <Notice>Chargement des amis…</Notice>
      ) : null}

      {friendsError ? (
        <Notice error>{friendsError}</Notice>
      ) : null}

      {!friendsLoading &&
        !friendsError &&
        friends.length === 0 ? (
          <Notice>
            Aucun ami confirmé disponible.
            Accepte d’abord une demande d’amitié.
          </Notice>
        ) : null}

      {friends.slice(0, 50).map(friend => (
        <Action
          key={friend.id}
          label={
            friend.id === friendId
              ? `✓ ${friend.name} — sélectionné`
              : friend.name
          }
          secondary={friend.id !== friendId}
          disabled={busy || friendsLoading}
          onPress={() => setFriendId(friend.id)}
        />
      ))}

      {friends.length > 50 ? (
        <Notice>
          Affichage des 50 premiers amis sur
          {` ${friends.length}`}. Une recherche
          sera ajoutée pour les grandes listes.
        </Notice>
      ) : null}

      {selectedFriend ? (
        <Notice>
          Destinataire : {selectedFriend.name}
        </Notice>
      ) : null}

      <Action
        label={
          busy
            ? 'Envoi en cours…'
            : selectedFriend
              ? `Inviter ${selectedFriend.name}`
              : 'Choisis un ami'
        }
        disabled={
          busy ||
          friendsLoading ||
          !selectedFriend
        }

        onPress={inviteFriend}
      />
    </>
  )
}
