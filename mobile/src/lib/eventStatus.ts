export function participationStatusLabel(status: string): string {
  switch (status) {
    case 'PENDING':
      return 'En attente'
    case 'ACCEPTED':
      return 'Acceptée'
    case 'REJECTED':
      return 'Refusée'
    default:
      return 'Statut inconnu'
  }
}

export function participationActionLabel(
  status: string
): string {
  switch (status) {
    case 'PENDING':
      return 'Refuser l’invitation'
    case 'ACCEPTED':
      return 'Quitter cet événement'
    default:
      return 'Supprimer l’invitation'
  }
}
