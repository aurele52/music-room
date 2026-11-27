import * as Location from 'expo-location'
import {
  validatePositionTimestamp,
  validateVoteCoordinates,
  type VoteCoordinates
} from './voteCoordinates'

/**
 * Demande une localisation ponctuelle, uniquement
 * à la suite d'une action explicite de vote.
 *
 * Aucun suivi en arrière-plan, aucun stockage local
 * des coordonnées, aucun mécanisme de surveillance.
 */
export async function getVoteCoordinates():
  Promise<VoteCoordinates> {
  const permission =
    await Location.requestForegroundPermissionsAsync()

  if (!permission.granted) {
    throw new Error(
      'Localisation refusée. Autorise la position dans les réglages du téléphone pour voter.'
    )
  }

  const enabled = await Location.hasServicesEnabledAsync()

  if (!enabled) {
    throw new Error(
      'Active la localisation du téléphone pour voter.'
    )
  }

  let position: Location.LocationObject

  try {
    position = await Location.getCurrentPositionAsync({
      accuracy: Location.Accuracy.High
    })
  } catch {
    throw new Error(
      'Impossible d’obtenir une position actuelle. Vérifie le GPS et réessaie.'
    )
  }

  validatePositionTimestamp(position.timestamp)

  // Une position signalée comme simulée est refusée.
  // Ce contrôle ne garantit pas l'absence de fraude.
  if (position.mocked === true) {
    throw new Error(
      'Une position simulée ne peut pas être utilisée pour voter.'
    )
  }

  return validateVoteCoordinates(position.coords)
}
