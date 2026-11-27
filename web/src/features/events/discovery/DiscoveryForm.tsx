import type { DiscoveryState } from './useEventDiscovery'

export default function DiscoveryForm({
  state
}: { state: DiscoveryState }) {
  const {
    title, setTitle, location, setLocation,
    search, loading
  } = state

  return (
    <form className="event-discovery-form" onSubmit={search}>
      <label htmlFor="discover-title">
        Rechercher par titre
      </label>
      <input
        id="discover-title"
        value={title}
        maxLength={80}
        onChange={(e) => setTitle(e.target.value)}
        placeholder="Concert, électro, jazz..."
      />

      <label htmlFor="discover-location">
        Filtrer par lieu
      </label>
      <input
        id="discover-location"
        value={location}
        maxLength={120}
        onChange={(e) => setLocation(e.target.value)}
        placeholder="Lyon, Paris..."
      />

      <button type="submit" disabled={loading}>
        Rechercher
      </button>
    </form>

  )
}
