import { useFriendsData } from './useFriendsData'
import { useFriendsSearch } from './useFriendsSearch'
import { useFriendsActions } from './useFriendsActions'

export function useFriends(token: string) {
  const data = useFriendsData(token)
  const search = useFriendsSearch(data)
  const actions = useFriendsActions(data)

  return {
    ...data,
    ...search,
    ...actions,
    disabled: data.busy || data.loading || !data.lists
  }
}

export type FriendsState =
  ReturnType<typeof useFriends>
