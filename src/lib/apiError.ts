/**
 * Localized API error.
 *
 * Carries a stable i18n `key` (and optional interpolation `params`) so
 * callers can render a translated, user-facing message instead of leaking
 * raw server/internal error text into the UI. `message` still holds a safe
 * English fallback so any caller that hasn't migrated to `getErrorMessage`
 * keeps its previous behavior.
 */
export class ApiError extends Error {
  readonly key: string;
  readonly params?: Record<string, string | number>;

  constructor(key: string, fallbackMessage: string, params?: Record<string, string | number>) {
    super(fallbackMessage);
    this.name = 'ApiError';
    this.key = key;
    this.params = params;
  }
}

/**
 * Resolve a user-facing, translated message for a thrown error.
 * Falls back to a generic translated message rather than echoing
 * unknown/raw error text (which may be untranslated server internals).
 */
export function getErrorMessage(
  error: unknown,
  t: (key: string, params?: Record<string, string | number>) => string,
): string {
  if (error instanceof ApiError) return t(error.key, error.params);
  return t('errors.general.unknown');
}
