import { useState } from 'react'
import {
  Pressable, StyleSheet, Text, View
} from 'react-native'
import type { CatalogTrack } from '../../../lib/musicCatalog'
import { theme } from '../../../ui/theme'
import { Notice } from '../../../ui/Controls'

type Props = {
  tracks: CatalogTrack[]
  selectedId: string
  onSelect: (id: string) => void
  disabled: boolean
}

export default function CatalogSelector({
  tracks, selectedId, onSelect, disabled
}: Props) {
  const [opened, setOpened] = useState(false)
  const selected = tracks.find(track => track.id === selectedId)

  return (
    <View style={styles.container}>
      <Text style={styles.label}>Catalogue musical</Text>

      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: opened, disabled }}
        disabled={disabled}
        style={styles.select}
        onPress={() => setOpened(value => !value)}
      >
        <Text style={styles.label}>
          {selected
            ? selected.title + ' — ' + selected.artist
            : 'Choisir un morceau'}
        </Text>
        <Text style={styles.label}>{opened ? '▲' : '▼'}</Text>
      </Pressable>

      {opened && !disabled ? (
        <View style={styles.options}>
          {tracks.length === 0 ? (
            <Notice>Aucun morceau disponible.</Notice>
          ) : null}

          {tracks.map(track => (
            <Pressable
              key={track.id}
              accessibilityRole="button"
              accessibilityState={{
                selected: track.id === selectedId
              }}
              style={styles.option}
              onPress={() => {
                onSelect(track.id)
                setOpened(false)
              }}
            >
              <Text style={styles.label}>{track.title}</Text>
              <Text style={styles.artist}>
                {track.artist}{track.premium ? ' — Premium' : ''}
              </Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  )
}

const styles = StyleSheet.create({
  container: { gap: 8 },
  label: {
    color: theme.text,
    fontWeight: '600'
  },
  select: {
    padding: 14,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    gap: 10
  },
  options: {
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 12
  },
  option: {
    padding: 14,
    gap: 4,
    borderBottomWidth: 1,
    borderBottomColor: theme.border
  },
  artist: {
    color: theme.muted,
    fontSize: 13
  }
})
