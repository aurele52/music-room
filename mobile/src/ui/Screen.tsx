import type { ReactNode } from 'react'
import { usePathname } from 'expo-router'
import {
  ScrollView,
  StyleSheet,
  Text,
  View
} from 'react-native'
import { SafeAreaView } from 'react-native-safe-area-context'
import { theme } from './theme'

export function Screen({
  title,
  subtitle,
  children
}: {
  title: string
  subtitle?: string
  children: ReactNode
}) {
  const pathname = usePathname()

  const hasTabs = [
    '/home',
    '/events',
    '/discover',
    '/friends',
    '/profile'
  ].includes(pathname)

  return (
    <SafeAreaView
      style={styles.safe}
      edges={hasTabs
        ? ['top', 'left', 'right']
        : ['top', 'bottom', 'left', 'right']}
    >
      <ScrollView
        contentContainerStyle={[
          styles.content,
          hasTabs && styles.tabContent
        ]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={styles.brand}>MUSIC ROOM</Text>
        <Text style={styles.title}>{title}</Text>
        {subtitle ? (
          <Text style={styles.subtitle}>{subtitle}</Text>
        ) : null}
        <View style={styles.body}>{children}</View>
      </ScrollView>
    </SafeAreaView>
  )
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: theme.background },
  content: {
    padding: 24,
    paddingBottom: 56,
    flexGrow: 1
  },
  tabContent: {
    paddingBottom: 24
  },
  brand: {
    color: theme.primary,
    fontSize: 13,
    fontWeight: '800',
    letterSpacing: 3,
    marginBottom: 24
  },
  title: {
    color: theme.text,
    fontSize: 30,
    fontWeight: '800',
    marginBottom: 8
  },
  subtitle: {
    color: theme.muted,
    lineHeight: 22,
    fontSize: 15
  },
  body: { marginTop: 26, gap: 14 }
})
