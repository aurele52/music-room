export function createAutoSync<T>(
  getScope: () => T | null,
  synchronize: (
    scope: T,
    current: () => boolean
  ) => Promise<unknown>
) {
  let running: Promise<void> | null = null
  let requested = false
  let stopped = false

  function request(): Promise<void> {
    if (stopped) return Promise.resolve()

    requested = true

    if (running) return running

    running = Promise.resolve().then(async () => {
      while (requested && !stopped) {
        requested = false

        const scope = getScope()

        if (!scope) continue

        await synchronize(
          scope,
          () => !stopped && getScope() === scope
        )
      }
    }).finally(() => {
      running = null
    })

    return running
  }

  function stop() {
    stopped = true
    requested = false
  }

  return { request, stop }
}
