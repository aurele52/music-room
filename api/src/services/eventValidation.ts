import type { EventVisibility } from '@prisma/client'

export type EventInput = {
  title: string
  description: string
  location: string
  startsAt: Date
  endsAt: Date
  visibility: EventVisibility
}

function cleanText(
  value: unknown,
  min: number,
  max: number,
  label: string
): string {
  if (typeof value !== 'string') {
    throw new Error(`${label} invalide`)
  }

  const clean = value.trim()

  const invalidCharacter = [...clean].some((character) => {
    const code = character.charCodeAt(0)
    return code < 32 && code !== 10
  })

  if (
    clean.length < min ||
    clean.length > max ||
    invalidCharacter
  ) {
    throw new Error(`${label} invalide`)
  }

  return clean
}

function parseDate(value: unknown): Date {
  if (typeof value !== 'string') {
    throw new Error('Date invalide')
  }

  const date = new Date(value)

  if (
    !Number.isFinite(date.getTime()) ||
    date.toISOString() !== value
  ) {
    throw new Error('Date ISO UTC invalide')
  }

  return date
}

export function validateEvent(
  input: unknown,
  now = new Date()
): EventInput {
  if (!input || typeof input !== 'object' || Array.isArray(input)) {
    throw new Error('Evenement invalide')
  }

  const data = input as Record<string, unknown>

  const title = cleanText(data.title, 3, 100, 'Titre')
  const description = cleanText(
    data.description ?? '', 0, 2000, 'Description'
  )
  const location = cleanText(
    data.location ?? '', 0, 120, 'Lieu'
  )

  const visibility = data.visibility ?? 'PUBLIC'

  if (
    visibility !== 'PUBLIC' &&
    visibility !== 'PRIVATE'
  ) {
    throw new Error('Visibilite invalide')
  }

  const startsAt = parseDate(data.startsAt)
  const endsAt = parseDate(data.endsAt)

  if (startsAt.getTime() <= now.getTime()) {
    throw new Error('Le debut doit etre dans le futur')
  }

  if (endsAt.getTime() <= startsAt.getTime()) {
    throw new Error('La fin doit suivre le debut')
  }

  return {
    title,
    description,
    location,
    visibility,
    startsAt,
    endsAt
  }
}
