import { Action, Notice } from '../../../ui/Controls'
import type { EventDraft } from '../../../lib/eventDraft'

interface Props {
  visibility: EventDraft['visibility']
  disabled: boolean
  onChange: (value: EventDraft['visibility']) => void
}

export default function EventVisibilityChoice({
  visibility,
  disabled,
  onChange
}: Props) {
  return (
    <>
      <Notice>
        Visibilité : {visibility === 'PUBLIC'
          ? 'Publique — visible dans la découverte'
          : 'Privée — réservée aux personnes autorisées'}
      </Notice>

      <Action
        label="Événement public"
        secondary={visibility !== 'PUBLIC'}
        disabled={disabled}
        onPress={() => onChange('PUBLIC')}
      />

      <Action
        label="Événement privé"
        secondary={visibility !== 'PRIVATE'}
        disabled={disabled}
        onPress={() => onChange('PRIVATE')}
      />
    </>
  )
}
