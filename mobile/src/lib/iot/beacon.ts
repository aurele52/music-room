// Manufacturer ID (2 bytes), MR1 (3 bytes), UUID (16 bytes).
export function decodeBeacon(data: Uint8Array): string | null {
  if (data.length !== 21 || data[0] !== 0xff || data[1] !== 0xff ||
      data[2] !== 0x4d || data[3] !== 0x52 || data[4] !== 0x31) {
    return null
  }

  const hex = Array.from(data.subarray(5), byte =>
    byte.toString(16).padStart(2, '0')).join('')

  return [
    hex.slice(0, 8),
    hex.slice(8, 12),
    hex.slice(12, 16),
    hex.slice(16, 20),
    hex.slice(20)
  ].join('-')
}
