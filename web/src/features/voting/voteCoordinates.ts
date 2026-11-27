// La géolocalisation n'est demandée qu'à l'action de vote.
// Aucune position n'est conservée dans le composant.
export async function voteCoordinates(): Promise<{
  latitude: number
  longitude: number
}> {
  if (
    typeof navigator === 'undefined' ||
    !navigator.geolocation
  ) {
    throw new Error(
      'Géolocalisation indisponible sur cet appareil.'
    )
  }

  return new Promise((resolve, reject) => {
    navigator.geolocation.getCurrentPosition(
      (position) => {
        resolve({
          latitude: position.coords.latitude,
          longitude: position.coords.longitude
        })
      },
      () => {
        reject(new Error(
          'Position GPS refusée ou indisponible.'
        ))
      },
      {
        enableHighAccuracy: true,
        maximumAge: 0,
        timeout: 10000
      }
    )
  })
}
