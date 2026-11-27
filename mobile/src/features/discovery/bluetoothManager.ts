import type { BleManager } from 'react-native-ble-plx'

let bleManager: BleManager | undefined

// Une seule instance native pendant la vie
// de l'application. Chargement uniquement au besoin.
export async function getBluetoothManager(): Promise<BleManager> {
  const { BleManager } = await import('react-native-ble-plx')

  bleManager ??= new BleManager()

  return bleManager
}
