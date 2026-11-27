import type { FormState, Policies } from './types'

// Afficher l'heure locale dans datetime-local.
// Les données transmises à l'API restent en UTC.
function toLocal(value: string | null): string {
  if (!value) return ''

  const date = new Date(value)
  if (!Number.isFinite(date.getTime())) return ''

  const local = new Date(
    date.getTime() - date.getTimezoneOffset() * 60000
  )

  return local.toISOString().slice(0, 16)
}

export function fromApi(data: Policies): FormState {
  return {
    votePolicy: data.votePolicy,
    editPolicy: data.editPolicy,
    timeEnabled: Boolean(
      data.voteWindowStart && data.voteWindowEnd
    ),
    timeStart: toLocal(data.voteWindowStart ?? null),
    timeEnd: toLocal(data.voteWindowEnd ?? null),
    geoEnabled:
      data.voteLatitude != null &&
      data.voteLongitude != null &&
      data.voteRadiusMeters != null,
    latitude: data.voteLatitude == null
      ? '' : String(data.voteLatitude),
    longitude: data.voteLongitude == null
      ? '' : String(data.voteLongitude),
    radius: data.voteRadiusMeters == null
      ? '' : String(data.voteRadiusMeters)
  }
}

export function toApi(form: FormState): Policies {
  let start: string | null = null
  let end: string | null = null

  if (form.timeEnabled) {
    if (!form.timeStart || !form.timeEnd) {
      throw new Error('Renseigne les deux horaires de vote.')
    }

    const startDate = new Date(form.timeStart)
    const endDate = new Date(form.timeEnd)

    if (
      !Number.isFinite(startDate.getTime()) ||
      !Number.isFinite(endDate.getTime()) ||
      startDate >= endDate
    ) {
      throw new Error('La plage horaire est invalide.')
    }

    start = startDate.toISOString()
    end = endDate.toISOString()
  }

  let latitude: number | null = null
  let longitude: number | null = null
  let radius: number | null = null

  if (form.geoEnabled) {
    if (
      !form.latitude.trim() ||
      !form.longitude.trim() ||
      !form.radius.trim()
    ) {
      throw new Error('Renseigne les trois paramètres GPS.')
    }

    latitude = Number(form.latitude)
    longitude = Number(form.longitude)
    radius = Number(form.radius)

    if (
      !Number.isFinite(latitude) ||
      latitude < -90 || latitude > 90 ||
      !Number.isFinite(longitude) ||
      longitude < -180 || longitude > 180 ||
      !Number.isInteger(radius) ||
      radius < 1 || radius > 50000
    ) {
      throw new Error('Coordonnées ou rayon GPS invalides.')
    }
  }

  return {
    votePolicy: form.votePolicy,
    editPolicy: form.editPolicy,
    voteWindowStart: start,
    voteWindowEnd: end,
    voteLatitude: latitude,
    voteLongitude: longitude,
    voteRadiusMeters: radius
  }
}
