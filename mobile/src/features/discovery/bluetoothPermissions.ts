import {
  PermissionsAndroid,
  Platform
} from 'react-native'

export async function bluetoothPermission(
  request: boolean
): Promise<boolean> {
  const p = PermissionsAndroid.PERMISSIONS

  const permissions = Number(Platform.Version) >= 31
    ? [
        p.BLUETOOTH_SCAN,
        p.BLUETOOTH_CONNECT,
        p.ACCESS_COARSE_LOCATION,
        p.ACCESS_FINE_LOCATION
      ]
    : [
        p.ACCESS_COARSE_LOCATION,
        p.ACCESS_FINE_LOCATION
      ]

  const checks = await Promise.all(
    permissions.map(permission =>
      PermissionsAndroid.check(permission)
    )
  )

  if (checks.every(Boolean)) return true
  if (!request) return false

  const result = await PermissionsAndroid.requestMultiple(
    permissions
  )

  return permissions.every(permission =>
    result[permission] === PermissionsAndroid.RESULTS.GRANTED
  )
}
