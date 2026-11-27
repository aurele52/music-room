import { Pressable, StyleSheet, Text, View } from 'react-native'
import type { MusicPlaylist } from '../../../lib/musicPlaylists'
import { theme } from '../../../ui/theme'

interface Props {
  playlist: MusicPlaylist
  onPress: () => void
  count?: number
}

export default function PlaylistSummary({
  playlist,
  onPress,
  count = playlist.items.length
}: Props) {
  return (
    <Pressable
      accessibilityRole="button"
      onPress={onPress}
      style={styles.card}
    >
      <View style={styles.information}>
        <Text style={styles.title}>
          {playlist.title}
        </Text>

        {playlist.description ? (
          <Text style={styles.detail} numberOfLines={2}>
            {playlist.description}
          </Text>
        ) : null}

        <Text style={styles.detail}>
          {count} morceau(x)
          {playlist.visibility === 'PRIVATE' ? ' · Privée' : ''}
        </Text>
      </View>

      <Text style={styles.arrow}>›</Text>
    </Pressable>
  )
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: theme.surface,
    padding: 16,
    borderRadius: 12,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12
  },
  information: {
    flex: 1,
    gap: 4
  },
  title: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '600'
  },
  detail: {
    color: theme.muted,
    fontSize: 13
  },
  arrow: {
    color: theme.primary,
    fontSize: 28
  }
})
