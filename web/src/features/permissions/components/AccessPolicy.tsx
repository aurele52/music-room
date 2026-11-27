import type { MusicPolicyState } from '../hooks/useMusicPolicy'
import type { Policy } from '../types'

export default function AccessPolicy({
  state
}: { state: MusicPolicyState }) {
  const { form, working, update } = state

  if (!form) return null

  return (
    <>
      <label>
        Qui peut voter ?
        <select
          value={form.votePolicy}
          disabled={working}
          onChange={(event) =>
            update('votePolicy', event.target.value as Policy)
          }
        >
          <option value="PUBLIC">Tous les utilisateurs</option>
          <option value="INVITED_ONLY">Participants invités</option>
        </select>
      </label>

      <label>
        Qui peut éditer les playlists ?
        <select
          value={form.editPolicy}
          disabled={working}
          onChange={(event) =>
            update('editPolicy', event.target.value as Policy)
          }
        >
          <option value="PUBLIC">Tous les utilisateurs</option>
          <option value="INVITED_ONLY">Participants invités</option>
        </select>
      </label>
    </>

  )
}
