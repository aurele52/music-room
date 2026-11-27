import {
  type ParticipationProps
} from '../hooks/useParticipationData'
import {
  useEventParticipation
} from '../hooks/useEventParticipation'
import ParticipationContent from './ParticipationContent'

export function EventParticipation(
  props: ParticipationProps
) {
  const state = useEventParticipation(props)

  return <ParticipationContent state={state} />
}
