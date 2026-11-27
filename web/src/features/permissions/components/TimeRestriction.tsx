import type { MusicPolicyState } from '../hooks/useMusicPolicy'

export default function TimeRestriction({
  state
}: { state: MusicPolicyState }) {
  const { form, working, update } = state

  if (!form) return null

  return (
    <>
      <fieldset>
        <legend>Restriction horaire du vote</legend>

        <label>
          <input
            type="checkbox"
            checked={form.timeEnabled}
            disabled={working}
            onChange={(event) =>
              update('timeEnabled', event.target.checked)
            }
          />
          Limiter le vote à une plage horaire
        </label>

        {form.timeEnabled && (
          <>
            <label>
              Début des votes
              <input
                type="datetime-local"
                value={form.timeStart}
                disabled={working}
                onChange={(event) =>
                  update('timeStart', event.target.value)
                }
              />
            </label>

            <label>
              Fin des votes
              <input
                type="datetime-local"
                value={form.timeEnd}
                disabled={working}
                onChange={(event) =>
                  update('timeEnd', event.target.value)
                }
              />
            </label>
          </>
        )}
      </fieldset>
    </>

  )
}
