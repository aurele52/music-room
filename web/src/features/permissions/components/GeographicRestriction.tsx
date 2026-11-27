import type { MusicPolicyState } from '../hooks/useMusicPolicy'

export default function GeographicRestriction({
  state
}: { state: MusicPolicyState }) {
  const { form, working, update } = state

  if (!form) return null

  return (
    <>
      <fieldset>
        <legend>Restriction géographique du vote</legend>

        <label>
          <input
            type="checkbox"
            checked={form.geoEnabled}
            disabled={working}
            onChange={(event) =>
              update('geoEnabled', event.target.checked)
            }
          />
          Limiter le vote à une zone GPS
        </label>

        {form.geoEnabled && (
          <>
            <label>
              Latitude du centre
              <input
                type="number"
                step="any"
                min={-90}
                max={90}
                value={form.latitude}
                disabled={working}
                onChange={(event) =>
                  update('latitude', event.target.value)
                }
                placeholder="48.69"
              />
            </label>

            <label>
              Longitude du centre
              <input
                type="number"
                step="any"
                min={-180}
                max={180}
                value={form.longitude}
                disabled={working}
                onChange={(event) =>
                  update('longitude', event.target.value)
                }
                placeholder="6.18"
              />
            </label>

            <label>
              Rayon autorisé (mètres)
              <input
                type="number"
                min={1}
                max={50000}
                step={1}
                value={form.radius}
                disabled={working}
                onChange={(event) =>
                  update('radius', event.target.value)
                }
                placeholder="500"
              />
            </label>
          </>
        )}

        <p className="notice">
          La position GPS déclarée par un appareil peut être
          falsifiée. Ce contrôle ne certifie pas une présence
          physique.
        </p>
      </fieldset>
    </>

  )
}
