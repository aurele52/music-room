import { useEventDetailData } from './useEventDetailData'
import { useEventDetailActions } from './useEventDetailActions'

export function useEventDetail() {
  const data = useEventDetailData()
  const actions = useEventDetailActions(data)

  return {
    ...data,
    ...actions
  }
}

export type EventDetailState =
  ReturnType<typeof useEventDetail>
