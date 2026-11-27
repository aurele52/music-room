import { StyleSheet } from 'react-native'
import { theme } from '../../../ui/theme'

export const styles = StyleSheet.create({
  heading: {
    color: theme.text,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 20
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    padding: 16,
    gap: 6,
    borderWidth: 1,
    borderColor: theme.border
  },
  eventTitle: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '700'
  },
  detail: { color: theme.muted, lineHeight: 20 }
})
