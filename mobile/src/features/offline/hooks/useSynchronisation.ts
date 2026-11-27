import {
  useSynchronisationData,
  type SynchronisationProps
} from './useSynchronisationData'
import {
  useSynchronisationActions
} from './useSynchronisationActions'

export function useSynchronisation(
  props: SynchronisationProps
) {
  const data = useSynchronisationData(props)
  const actions = useSynchronisationActions(data)

  return {
    ...data,
    ...actions
  }
}

export type SynchronisationState =
  ReturnType<typeof useSynchronisation>
