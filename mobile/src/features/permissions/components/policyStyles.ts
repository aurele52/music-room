import { StyleSheet } from 'react-native'
import { theme } from '../../../ui/theme'

export const styles = StyleSheet.create({
  card: {
    padding: 16,
    gap: 16,
    borderWidth: 1,
    borderColor: theme.border,
    borderRadius: 14,
    backgroundColor: theme.surface
  },
  section: {
    gap: 9
  },
  heading: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text
  },
  toggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12
  }
})
