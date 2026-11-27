import { useEffect, useState } from 'react'
import type { FormEvent } from 'react'
import { subscribeAccountRealtime } from '../../../services/realtime/friendsRealtime'
import type { MusicEvent, EventForm, ApiError, Props } from '../types'

const emptyForm: EventForm = {
  title: '',
  description: '',
  location: '',
  startsAt: '',
  endsAt: '',
  visibility: 'PUBLIC'
}

// Convertir un instant UTC en valeur datetime-local
// sans décaler artificiellement l'heure affichée.
function toLocalInput(value: string): string {
  const date = new Date(value)
  const pad = (number: number) => String(number).padStart(2, '0')

  return [
    date.getFullYear(),
    '-',
    pad(date.getMonth() + 1),
    '-',
    pad(date.getDate()),
    'T',
    pad(date.getHours()),
    ':',
    pad(date.getMinutes())
  ].join('')
}

export function useEvents({ token, onAuthError }: Props) {
  const [events, setEvents] = useState<MusicEvent[]>([])
  const [form, setForm] = useState<EventForm>(emptyForm)
  const [editingId, setEditingId] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [working, setWorking] = useState(false)
  const [revision, setRevision] = useState(0)
  const [error, setError] = useState('')
  const [message, setMessage] = useState('')

  async function request<T>(
    path: string,
    method = 'GET',
    body?: unknown
  ): Promise<T> {
    const response = await fetch(`/api${path}`, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      ...(body === undefined
        ? {}
        : { body: JSON.stringify(body) })
    })

    const data = await response.json()

    if (!response.ok) {
      const failure = new Error(
        data.error || 'Erreur du serveur'
      ) as ApiError

      failure.status = response.status
      failure.code = data.code
      throw failure
    }

    return data as T
  }

  useEffect(() => {
    let cancelled = false

    setLoading(true)

    void request<{ events: MusicEvent[] }>('/events/mine')
      .then((data) => {
        if (!cancelled) {
          setEvents(data.events)
          setError('')
        }
      })
      .catch((err: unknown) => {
        if (!cancelled && !onAuthError(err)) {
          setError(err instanceof Error ? err.message : 'Erreur de chargement')
        }
      })
      .finally(() => {
        if (!cancelled) setLoading(false)
      })

    return () => { cancelled = true }
  }, [token, revision])

  useEffect(() => {
    return subscribeAccountRealtime(
      token,
      'events:changed',
      () => setRevision(value => value + 1)
    )
  }, [token])

  function updateField<K extends keyof EventForm>(
    field: K,
    value: EventForm[K]
  ) {
    setForm((current) => ({ ...current, [field]: value }))
  }

  function startEditing(event: MusicEvent) {
    setEditingId(event.id)
    setForm({
      title: event.title,
      description: event.description,
      location: event.location,
      startsAt: toLocalInput(event.startsAt),
      endsAt: toLocalInput(event.endsAt),
      visibility: event.visibility
    })
    setError('')
    setMessage('')
  }

  function resetForm() {
    setEditingId(null)
    setForm(emptyForm)
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (working) return

    const start = new Date(form.startsAt)
    const end = new Date(form.endsAt)

    if (
      !Number.isFinite(start.getTime()) ||
      !Number.isFinite(end.getTime())
    ) {
      setError('Dates invalides')
      return
    }

    setWorking(true)
    setError('')
    setMessage('')

    try {
      await request(
        editingId ? `/events/${editingId}` : '/events',
        editingId ? 'PUT' : 'POST',
        {
          ...form,
          startsAt: start.toISOString(),
          endsAt: end.toISOString()
        }
      )

      setMessage(
        editingId ? 'Événement modifié.' : 'Événement créé.'
      )
      resetForm()
      setRevision((value) => value + 1)
      return true
    } catch (err) {
      if (!onAuthError(err)) {
        setError(err instanceof Error ? err.message : 'Enregistrement impossible')
      }
    } finally {
      setWorking(false)
    }
  }

  async function remove(event: MusicEvent) {
    if (working) return

    if (!window.confirm(`Supprimer l'événement "${event.title}" ?`)) {
      return
    }

    setWorking(true)
    setError('')
    setMessage('')

    try {
      await request(`/events/${event.id}`, 'DELETE')

      if (editingId === event.id) resetForm()
      setMessage('Événement supprimé.')
      setRevision((value) => value + 1)
      return true
    } catch (err) {
      if (!onAuthError(err)) {
        setError(err instanceof Error ? err.message : 'Suppression impossible')
      }
    } finally {
      setWorking(false)
    }
  }


  return {
    events, form, editingId,
    loading, working, error, message,
    updateField, startEditing, resetForm, save, remove
  }
}

export type EventsState = ReturnType<typeof useEvents>
