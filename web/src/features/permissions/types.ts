export type Policy = 'PUBLIC' | 'INVITED_ONLY'

export type Policies = {
  votePolicy: Policy
  editPolicy: Policy
  voteWindowStart: string | null
  voteWindowEnd: string | null
  voteLatitude: number | null
  voteLongitude: number | null
  voteRadiusMeters: number | null
}

export type FormState = {
  votePolicy: Policy
  editPolicy: Policy
  timeEnabled: boolean
  timeStart: string
  timeEnd: string
  geoEnabled: boolean
  latitude: string
  longitude: string
  radius: string
}

export type Props = {
  eventId: string
  token: string
  onAuthError: (error: unknown) => boolean
}
