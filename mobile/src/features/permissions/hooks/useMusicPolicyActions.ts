import { errorMessage } from '../../../lib/api'
import {
  buildMusicPolicies,
  canEditMusicPolicies,
  updateMusicPolicies,
  musicPoliciesToLocalForm,
  localMusicPolicyFormToApiForm,
  type MusicPolicyForm
} from '../../../lib/musicPolicies'
import type { MusicPolicyData } from './useMusicPolicyData'

export function useMusicPolicyActions(data: MusicPolicyData) {
  const {
    id,
    token,
    viewerId,
    event,
    setEvent,
    form,
    setForm,
    loading,
    setBusy,
    setError,
    setMessage,
    activeRef,
    busyRef,
    operationFence
  } = data

  function update<K extends keyof MusicPolicyForm>(
    key: K,
    value: MusicPolicyForm[K]
  ) {
    if (busyRef.current) return

    setForm(previous =>
      previous
        ? { ...previous, [key]: value }
        : previous
    )
    setMessage('')
  }

  async function save() {
    if (
      !form ||
      !event ||
      !token ||
      !activeRef.current ||
      loading ||
      busyRef.current ||
      !canEditMusicPolicies(
        event.organizerId === viewerId,
        event.endsAt
      )
    ) return

    // Valider entièrement avant d'envoyer la requête.
    let payloadForm: MusicPolicyForm

    try {
      payloadForm = localMusicPolicyFormToApiForm(form)
      buildMusicPolicies(payloadForm)
    } catch (failure) {
      setError(errorMessage(failure))
      return
    }

    busyRef.current = true

    const scope = operationFence.capture()
    const current = () =>
      activeRef.current &&
      operationFence.isCurrent(scope)

    setBusy(true)
    setError('')
    setMessage('')

    try {
      const updated = await updateMusicPolicies(
        id,
        token,
        payloadForm
      )

      if (!current()) return

      setForm(musicPoliciesToLocalForm(updated))
      setMessage('Règles musicales enregistrées.')
    } catch (failure) {
      if (!current()) return

      setError(errorMessage(failure))

      // En cas de changement de permission ou de
      // disparition de l'événement, retirer les données
      // potentiellement privées de l'écran.
      const status = (failure as {
        status?: number
      }).status

      if (status === 403 || status === 404) {
        setEvent(null)
        setForm(null)
      }
    } finally {
      busyRef.current = false
      if (current()) setBusy(false)
    }
  }


  return {
    update,
    save
  }
}
