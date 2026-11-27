export function createOfflineLock() {
  let queue: Promise<void> = Promise.resolve()

  function run<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    const result = queue.then(operation)

    queue = result.then(
      () => undefined,
      () => undefined
    )

    return result
  }

  return { run }
}

export const offlineLock = createOfflineLock()
