import { describe, expect, it } from 'vitest'
import { fromApi, toApi } from '../src/features/permissions/policyForm'
import type { Policies } from '../src/features/permissions/types'

const defaults: Policies = {
  votePolicy: 'PUBLIC',
  editPolicy: 'PUBLIC',
  voteWindowStart: null,
  voteWindowEnd: null,
  voteLatitude: null,
  voteLongitude: null,
  voteRadiusMeters: null
}

describe('Validation des licences musicales', () => {
  it('conserve les politiques sans restriction', () => {
    expect(toApi(fromApi(defaults))).toEqual(defaults)
  })

  it('conserve des permissions independantes', () => {
    const form = fromApi(defaults)
    form.votePolicy = 'INVITED_ONLY'

    expect(toApi(form).votePolicy).toBe('INVITED_ONLY')
    expect(toApi(form).editPolicy).toBe('PUBLIC')
  })

  it('refuse une restriction horaire incomplete', () => {
    const form = fromApi(defaults)
    form.timeEnabled = true

    expect(() => toApi(form)).toThrow()
  })

  it('refuse une plage horaire inversee', () => {
    const form = fromApi(defaults)

    form.timeEnabled = true
    form.timeStart = '2027-01-02T12:00'
    form.timeEnd = '2027-01-02T10:00'

    expect(() => toApi(form)).toThrow()
  })

  it('conserve des horaires UTC valides', () => {
    const original = {
      ...defaults,
      voteWindowStart: '2027-01-02T10:00:00.000Z',
      voteWindowEnd: '2027-01-02T12:00:00.000Z'
    }

    expect(toApi(fromApi(original))).toEqual(original)
  })

  it('refuse une zone GPS incomplete', () => {
    const form = fromApi(defaults)
    form.geoEnabled = true

    expect(() => toApi(form)).toThrow()
  })

  it('accepte les coordonnees nulles', () => {
    const form = fromApi(defaults)

    form.geoEnabled = true
    form.latitude = '0'
    form.longitude = '0'
    form.radius = '500'

    expect(toApi(form)).toEqual({
      ...defaults,
      voteLatitude: 0,
      voteLongitude: 0,
      voteRadiusMeters: 500
    })
  })

  it.each([
    ['91', '0', '500'],
    ['-91', '0', '500'],
    ['0', '181', '500'],
    ['0', '-181', '500'],
    ['0', '0', '0'],
    ['0', '0', '50001'],
    ['0', '0', '2.5'],
    ['abc', '0', '500']
  ])(
    'refuse la zone GPS invalide %s %s %s',
    (latitude, longitude, radius) => {
      const form = fromApi(defaults)

      form.geoEnabled = true
      form.latitude = latitude
      form.longitude = longitude
      form.radius = radius

      expect(() => toApi(form)).toThrow()
    }
  )

  it('supprime les restrictions desactivees', () => {
    const form = fromApi({
      ...defaults,
      voteLatitude: 48,
      voteLongitude: 2,
      voteRadiusMeters: 500
    })

    form.geoEnabled = false

    expect(toApi(form)).toEqual(defaults)
  })
})
