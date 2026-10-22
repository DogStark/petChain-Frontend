const UNITS = ['B', 'KB', 'MB', 'GB'] as const;

/** Formats a byte count for display, e.g. 1536 -> "1.5 KB". */
export function formatBytes(bytes: number): string {
  if (!Number.isFinite(bytes) || bytes <= 0) return '0 B';

  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < UNITS.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  return unitIndex === 0 ? `${Math.round(value)} B` : `${value.toFixed(1)} ${UNITS[unitIndex]}`;
}
