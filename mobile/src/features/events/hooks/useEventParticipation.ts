import {
  useParticipationData,
  type ParticipationProps
} from './useParticipationData'
import { useParticipationActions } from './useParticipationActions'

export function useEventParticipation(
  props: ParticipationProps
) {
  const data = useParticipationData(props)
  const actions = useParticipationActions(data)

  return {
    ...data,
    ...actions
  }
}

export type ParticipationState =
  ReturnType<typeof useEventParticipation>
