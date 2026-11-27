import type { ReactNode } from 'react'
import {
  Pressable,
  StyleSheet,
  Text,
  TextInput,
  View,
  type TextInputProps
} from 'react-native'
import { theme } from './theme'

export function Field({
  label,
  ...props
}: TextInputProps & { label: string }) {
  return (
    <View style={styles.field}>
      <Text style={styles.label}>{label}</Text>
      <TextInput
        {...props}
        placeholderTextColor={theme.muted}
        style={styles.input}
        autoCapitalize={props.autoCapitalize ?? 'none'}
      />
    </View>
  )
}

export function Action({
  label,
  onPress,
  disabled = false,
  secondary = false
}: {
  label: string
  onPress: () => void
  disabled?: boolean
  secondary?: boolean
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={label}
      disabled={disabled}
      onPress={onPress}
      style={[
        styles.button,
        secondary && styles.secondary,
        disabled && styles.disabled
      ]}
    >
      <Text style={[
        styles.buttonText,
        secondary && styles.secondaryText
      ]}>
        {label}
      </Text>
    </Pressable>
  )
}

export function Notice({
  children,
  error = false
}: {
  children: ReactNode
  error?: boolean
}) {
  return (
    <Text
      accessibilityRole="alert"
      style={[styles.notice, error && styles.error]}
    >
      {children}
    </Text>
  )
}

const styles = StyleSheet.create({
  field: { gap: 8 },
  label: { color: theme.text, fontWeight: '600' },
  input: {
    color: theme.text,
    borderColor: theme.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 14,
    paddingVertical: 13,
    fontSize: 16
  },
  button: {
    backgroundColor: theme.primary,
    padding: 15,
    borderRadius: 12,
    alignItems: 'center'
  },
  secondary: {
    backgroundColor: theme.surface,
    borderColor: theme.border,
    borderWidth: 1
  },
  disabled: { opacity: 0.5 },
  buttonText: {
    color: theme.background,
    fontWeight: '800',
    fontSize: 15
  },
  secondaryText: { color: theme.text },
  notice: {
    color: theme.muted,
    lineHeight: 21
  },
  error: { color: theme.danger }
})
