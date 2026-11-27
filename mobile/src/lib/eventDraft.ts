export interface EventDraft {
  title: string
  description: string
  location: string
  startsAt: string
  endsAt: string
  visibility: 'PUBLIC' | 'PRIVATE'
}

// Date saisie en heure locale : YYYY-MM-DD HH:mm.
// Les composants sont vérifiés explicitement pour rejeter
// les dates impossibles et les heures inexistantes.
export function parseLocalDateTime(input: string): Date | null {
  const match = /^(\d{4})-(\d{2})-(\d{2})[ T](\d{2}):(\d{2})$/
    .exec(input.trim())

  if (!match) return null

  const [, year, month, day, hour, minute] = match
  const values = [
    Number(year),
    Number(month),
    Number(day),
    Number(hour),
    Number(minute)
  ]

  const [y, m, d, h, min] = values

  if (
    y < 2000 || y > 2100 ||
    m < 1 || m > 12 ||
    d < 1 || d > 31 ||
    h > 23 || min > 59
  ) {
    return null
  }

  const date = new Date(y, m - 1, d, h, min)

  if (
    date.getFullYear() !== y ||
    date.getMonth() !== m - 1 ||
    date.getDate() !== d ||
    date.getHours() !== h ||
    date.getMinutes() !== min
  ) {
    return null
  }

  return date
}

export function buildEventPayload(
  draft: EventDraft,
  now = new Date()
) {
  const title = draft.title.trim()
  const description = draft.description.trim()
  const location = draft.location.trim()

  if (title.length < 3 || title.length > 100) {
    throw new Error('Le titre doit contenir entre 3 et 100 caractères.')
  }

  if (description.length > 2000) {
    throw new Error('La description ne peut pas dépasser 2 000 caractères.')
  }

  if (location.length > 120) {
    throw new Error('Le lieu doit contenir entre 2 et 120 caractères.')
  }

  // Aligner les caractères interdits sur
  // api/src/services/eventValidation.ts :
  // contrôles ASCII sauf retour à la ligne (LF).
  const invalidControl = (value: string) =>
    [...value].some(character => {
      const code = character.charCodeAt(0)
      return code < 32 && code !== 10
    })

  if (
    invalidControl(title) ||
    invalidControl(description) ||
    invalidControl(location)
  ) {
    throw new Error(
      'Le texte contient des caractères de contrôle interdits.'
    )
  }

  if (!['PUBLIC', 'PRIVATE'].includes(draft.visibility)) {
    throw new Error('Visibilité invalide.')
  }

  const start = parseLocalDateTime(draft.startsAt)
  const end = parseLocalDateTime(draft.endsAt)

  if (!start || !end) {
    throw new Error(
      'Dates invalides. Format attendu : AAAA-MM-JJ HH:mm.'
    )
  }

  if (start.getTime() <= now.getTime()) {
    throw new Error('Le début doit être dans le futur.')
  }

  if (end.getTime() <= start.getTime()) {
    throw new Error('La fin doit être après le début.')
  }

  return {
    title,
    description,
    location,
    startsAt: start.toISOString(),
    endsAt: end.toISOString(),
    visibility: draft.visibility
  }
}

// Adapter les dates de l'API à la saisie en heure locale.
export function formatLocalDateTime(value: string): string {
  const date = new Date(value)

  if (!Number.isFinite(date.getTime())) {
    throw new Error('Date invalide')
  }

  const pad = (n: number) => String(n).padStart(2, '0')

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    ' ',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes())
  ].join('')
}

// TODO : gérer explicitement les heures ambiguës lors du
// changement d'heure hiver/été. Date utilise le fuseau du mobile.

/** Remplacer le jour en conservant l'heure locale. */
export function withCalendarDate(
  current: Date,
  selected: Date
): Date {
  return new Date(
    selected.getFullYear(),
    selected.getMonth(),
    selected.getDate(),
    current.getHours(),
    current.getMinutes()
  )
}

/** Remplacer l'heure en conservant le jour local. */
export function withClockTime(
  current: Date,
  selected: Date
): Date {
  return new Date(
    current.getFullYear(),
    current.getMonth(),
    current.getDate(),
    selected.getHours(),
    selected.getMinutes()
  )
}

/** Valeur initiale proposée lorsque le champ est vide. */
export function suggestedEventDate(
  kind: 'start' | 'end',
  now = new Date()
): Date {
  const result = new Date(now)

  result.setSeconds(0, 0)
  result.setMinutes(0)
  result.setHours(result.getHours() + 1)

  if (kind === 'end') {
    result.setHours(result.getHours() + 3)
  }

  return result
}
