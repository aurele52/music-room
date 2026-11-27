import { useOfflineHome } from './hooks/useOfflineHome'
import OfflineHomeContent from './components/OfflineHomeContent'

export function OfflineHome({
  userId
}: {
  userId: string
}) {
  const state = useOfflineHome(userId)

  return <OfflineHomeContent state={state} />
}
