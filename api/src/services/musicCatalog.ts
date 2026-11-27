const freeTracks = [
  ['blue-horizon', 'Blue Horizon'],
  ['midnight-groove', 'Midnight Groove'],
  ['summer-night', 'Summer Night'],
  ['morning-light', 'Morning Light'],
  ['neon-city', 'Neon City']
]

const premiumTracks = [
  ['cosmic-journey', 'Cosmic Journey'],
  ['deep-pulse', 'Deep Pulse'],
  ['golden-sunset', 'Golden Sunset'],
  ['electric-dreams', 'Electric Dreams']
]

function catalogTrack(
  id: string,
  title: string,
  premium: boolean
) {
  return {
    id,
    title,
    artist: 'Music Room',
    premium,
    audioUrl: `/api/audio/${id}.wav`
  }
}

export const musicCatalog = [
  ...freeTracks.map(([id, title]) =>
    catalogTrack(id, title, false)
  ),
  ...premiumTracks.map(([id, title]) =>
    catalogTrack(id, title, true)
  )
]

export function availableCatalog(
  subscription: 'FREE' | 'PREMIUM'
) {
  return musicCatalog.filter(track =>
    !track.premium || subscription === 'PREMIUM'
  )
}

export function findCatalogTrack(
  title: string,
  artist: string
) {
  return musicCatalog.find(track =>
    track.title.toLowerCase() === title.toLowerCase() &&
    track.artist.toLowerCase() === artist.toLowerCase()
  )
}

export function findCatalogTrackById(id: unknown) {
  return musicCatalog.find(track => track.id === id)
}
