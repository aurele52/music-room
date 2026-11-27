import { useEffect } from 'react'
import { AppState } from 'react-native'
import Constants from 'expo-constants'
import type {
  BleManager,
  State
} from 'react-native-ble-plx'
import { api, type MusicEvent } from '../../../lib/api'
import {
  createDiscovery,
  decodeAdvertisement
} from '../../../lib/iot/discovery'
import {
  isCurrentSessionToken
} from '../../../session/SessionProvider'
import { scanQueue } from '../../../lib/iot/scanQueue'
import {
  bluetoothPermission
} from '../bluetoothPermissions'
import {
  getBluetoothManager
} from '../bluetoothManager'
import { showNearbyEvent } from '../nearbyEventAlert'

export function useNearbyEvents(token: string) {
  useEffect(() => {
    if (
      !token ||
      !isCurrentSessionToken(token) ||
      Constants.executionEnvironment === 'storeClient'
    ) return

    let alive = true
    let active = AppState.currentState === 'active' ||
      AppState.currentState == null

    const sessionCurrent = () =>
      alive && isCurrentSessionToken(token)

    let permitted = false
    let permissionRequested = false
    let checking = false
    let scanning = false
    let showing = false
    let generation = 0

    let radio: State = 'Unknown' as State
    let ble: BleManager | undefined

    let stateSubscription:
      { remove(): void } | undefined

    const discovery = createDiscovery(async id => {
      const result = await api<{ event: MusicEvent }>(
        `/events/${id}`,
        { token }
      )
      return result.event
    })

    function stopScan() {
      generation++

      if (ble && scanning) {
        scanning = false

        const scanner = ble

        void scanQueue.run(() =>
          scanner.stopDeviceScan()
        ).catch(() => {
          console.warn('[IoT] Arrêt du scan impossible')
        })
      }
    }

    function updateScan() {
      if (
        !sessionCurrent() ||
        !active ||
        !permitted ||
        radio !== 'PoweredOn'
      ) {
        stopScan()
        return
      }

      if (!ble || scanning) return

      scanning = true
      const stamp = ++generation

      const current = () =>
        sessionCurrent() &&
        active &&
        permitted &&
        radio === 'PoweredOn' &&
        stamp === generation

      const scanner = ble

      void scanQueue.run(async () => {
        // Un demarrage peut etre devenu obsolete
        // pendant son attente dans la file.
        if (!current()) return

        await scanner.startDeviceScan(
        null,
        { allowDuplicates: true },
        (error, device) => {
          if (!current()) return

          if (error) {
            console.warn('[IoT] Scan Bluetooth :', error.errorCode)
            stopScan()
            return
          }

          if (
            !device ||
            showing ||
            device.rssi === null ||
            device.rssi < -75
          ) return

          const id = decodeAdvertisement(device.manufacturerData)

          if (!id) return

          void discovery.receive(id, current).then(event => {
            if (!event || !current() || showing) return

            showing = true

            const close = () => {
              showing = false
            }

            showNearbyEvent(event, current, close)
          })
        }
        )
      }).catch(error => {
        if (!current()) return
        console.warn('[IoT] Démarrage du scan impossible', error)
        stopScan()
      })
    }

    async function reconcile() {
      if (!sessionCurrent() || !active || checking) return

      checking = true

      try {
        const request = !permissionRequested
        permissionRequested = true

        // Revalider les permissions avant de reprendre.
        permitted = false
        stopScan()

        permitted = await bluetoothPermission(request)

        if (!sessionCurrent()) return

        if (permitted && !ble) {
          const scanner = await getBluetoothManager()

          if (!sessionCurrent()) return

          ble = scanner

          stateSubscription = ble.onStateChange(state => {
            radio = state
            updateScan()
          }, true)
        }

        updateScan()
      } catch {
        console.warn('[IoT] Bluetooth indisponible')
        stopScan()
      } finally {
        checking = false
      }
    }

    const appSubscription = AppState.addEventListener(
      'change',
      state => {
        active = state === 'active'

        if (active) {
          void reconcile()
        } else {
          stopScan()
        }
      }
    )

    void reconcile()

    return () => {
      alive = false
      stopScan()
      appSubscription.remove()
      stateSubscription?.remove()
    }
  }, [token])

}
