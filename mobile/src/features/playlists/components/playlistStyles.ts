import { StyleSheet } from 'react-native'
import { theme } from '../../../ui/theme'

export const styles = StyleSheet.create({
  card: {
    gap: 12,
    padding: 16,
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 14
  },
  heading: {
    fontSize: 19,
    fontWeight: '800',
    color: theme.text
  },
  subheading: {
    fontSize: 16,
    fontWeight: '700',
    color: theme.text
  },
  addForm: {
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border
  },
  item: {
    gap: 8,
    paddingVertical: 10,
    borderTopWidth: 1,
    borderTopColor: theme.border
  },
  itemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: theme.text
  },
  detail: {
    color: theme.muted,
    fontSize: 14
  },
  actions: {
    flexDirection: 'row',
    gap: 8
  },
  action: {
    flex: 1
  }
})
