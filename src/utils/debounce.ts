export interface DebouncedFn<T extends (...args: unknown[]) => unknown> {
  (...args: Parameters<T>): void;
  /** Cancel any pending invocation without executing the underlying function. */
  cancel(): void;
}

export function debounce<T extends (...args: unknown[]) => unknown>(
  func: T,
  wait: number
): DebouncedFn<T> {
  let timeout: NodeJS.Timeout | null = null;

  function executedFunction(...args: Parameters<T>) {
    if (timeout) clearTimeout(timeout);
    timeout = setTimeout(() => {
      timeout = null;
      func(...args);
    }, wait);
  }

  executedFunction.cancel = () => {
    if (timeout) {
      clearTimeout(timeout);
      timeout = null;
    }
  };

  return executedFunction;
}
