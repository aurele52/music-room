import { StyleSheet } from 'react-native'
import { theme } from '../../../ui/theme'

export const styles = StyleSheet.create({
  heading: {
    color: theme.text,
    fontSize: 21,
    fontWeight: '800',
    marginTop: 16
  },
  card: {
    backgroundColor: theme.surface,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: theme.border,
    padding: 16,
    gap: 10
  },
  name: {
    color: theme.text,
    fontSize: 17,
    fontWeight: '700'
  },
  detail: {
    color: theme.text,
    lineHeight: 21
  }
})
