import { useState } from 'react'
import {
  Platform,
  StyleSheet,
  Text,
  View
} from 'react-native'
import DateTimePicker, {
  DateTimePickerAndroid
} from '@react-native-community/datetimepicker'
import {
  formatLocalDateTime,
  parseLocalDateTime,
  suggestedEventDate,
  withCalendarDate,
  withClockTime
} from '../lib/eventDraft'
import { Action } from './Controls'
import { theme } from './theme'

interface Props {
  label: string
  value: string
  onChangeText: (value: string) => void
  kind: 'start' | 'end'
  disabled?: boolean
}

function formatDisplay(value: string): string {
  const date = parseLocalDateTime(value)

  if (!date) return 'Aucune date sélectionnée'

  return date.toLocaleString('fr-FR', {
    dateStyle: 'full',
    timeStyle: 'short'
  })
}

export function DateTimeField({
  label,
  value,
  onChangeText,
  kind,
  disabled = false
}: Props) {
  const [visible, setVisible] = useState(false)

  const selected =
    parseLocalDateTime(value) ??
    suggestedEventDate(kind)

  function select(date: Date) {
    if (!Number.isFinite(date.getTime())) return

    onChangeText(formatLocalDateTime(date.toISOString()))
  }

  function openAndroid() {
    const initial = selected

    DateTimePickerAndroid.open({
      mode: 'date',
      value: initial,
      onChange: (event, calendarDate) => {
        if (event.type !== 'set' || !calendarDate) return

        const updated = withCalendarDate(
          initial,
          calendarDate
        )

        DateTimePickerAndroid.open({
          mode: 'time',
          value: updated,
          is24Hour: true,
          onChange: (timeEvent, timeDate) => {
            if (
              timeEvent.type !== 'set' ||
              !timeDate
            ) {
              return
            }

            select(withClockTime(updated, timeDate))
          }
        })
      }
    })
  }

  function open() {
    if (disabled) return

    if (Platform.OS === 'android') {
      openAndroid()
    } else {
      setVisible(previous => !previous)
    }
  }

  return (
    <View style={styles.container}>
      <Text style={styles.label}>{label}</Text>

      <Text style={styles.value}>
        {formatDisplay(value)}
      </Text>

      <Action
        label={
          value
            ? 'Modifier la date et l’heure'
            : 'Choisir une date et une heure'
        }
        secondary
        disabled={disabled}
        onPress={open}
      />

      {Platform.OS === 'ios' && visible ? (
        <>
          <DateTimePicker
            value={selected}
            mode="datetime"
            display="spinner"
            minuteInterval={1}
            locale="fr-FR"
            onChange={(event, nextDate) => {
              if (event.type === 'set' && nextDate) {
                select(nextDate)
              }
            }}
          />

          <Action
            label="Terminer"
            secondary
            onPress={() => setVisible(false)}
          />
        </>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: {
    gap: 9,
    paddingVertical: 6
  },
  label: {
    fontSize: 14,
    fontWeight: '700',
    color: theme.text
  },
  value: {
    fontSize: 15,
    color: theme.muted
  }
})
