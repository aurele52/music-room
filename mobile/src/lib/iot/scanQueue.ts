export function createScanQueue() {
  let pending: Promise<void> = Promise.resolve()

  function run<T>(
    operation: () => Promise<T>
  ): Promise<T> {
    const result = pending.then(operation)

    pending = result.then(
      () => undefined,
      () => undefined
    )

    return result
  }

  return { run }
}

export const scanQueue = createScanQueue()
