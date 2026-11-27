import { useEventDiscovery } from './useEventDiscovery'
import DiscoveryForm from './DiscoveryForm'
import DiscoveryResults from './DiscoveryResults'
import DiscoveryDetail from './DiscoveryDetail'
import type { Props } from './types'

export default function EventDiscovery(props: Props) {
  const state = useEventDiscovery(props)

  return (
    <section className="profile">
      {state.error && (
        <p className="error" role="alert">{state.error}</p>
      )}

      {state.selected ? (
        <DiscoveryDetail state={state} {...props} />
      ) : (
        <>
          <h2>Découvrir des événements</h2>
          <p className="notice">
            Concerts, soirées et rencontres musicales publics.
          </p>
          <DiscoveryForm state={state} />
          <DiscoveryResults state={state} />
        </>
      )}
    </section>
  )
}
