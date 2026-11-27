import { useProfileData } from './useProfileData'
import { useProfileActions } from './useProfileActions'

export function useProfile() {
  const data = useProfileData()
  const actions = useProfileActions(data)

  return {
    ...data,
    ...actions
  }
}

export type ProfileState =
  ReturnType<typeof useProfile>
