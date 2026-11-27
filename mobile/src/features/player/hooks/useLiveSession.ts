import { currentSessionTrack } from '../../../lib/musicSessions'
import { useSessionData } from './useSessionData'
import { useSessionActions } from './useSessionActions'

export function useLiveSession() {
  const source = useSessionData()
  const actions = useSessionActions(source)

  const { data, loading, busy } = source

  const live = data?.session ?? null
  const currentTrack = currentSessionTrack(live)
  const canControl = !!data?.canControl && !loading && !busy
  const canOperate = canControl && !!live &&
    live.state !== 'STOPPED'


  return {
    ...source,
    ...actions,
    live,
    currentTrack,
    canControl,
    canOperate
  }
}

export type LiveSessionState = ReturnType<typeof useLiveSession>
