import { canEditMusicPolicies } from '../../../lib/musicPolicies'
import { useMusicPolicyData } from './useMusicPolicyData'
import { useMusicPolicyActions } from './useMusicPolicyActions'

export function useMusicPolicy() {
  const data = useMusicPolicyData()
  const actions = useMusicPolicyActions(data)

  const { event, viewerId } = data

  const editable = !!event && canEditMusicPolicies(
    event.organizerId === viewerId,
    event.endsAt
  )


  return {
    ...data,
    ...actions,
    editable
  }
}

export type MusicPolicyState =
  ReturnType<typeof useMusicPolicy>
