export function isValidEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

export function isValidPhone(value: string): boolean {
  return /^[\d\s\-+()]+$/.test(value);
}

// Only allow same-origin relative paths (e.g. "/dashboard/pets/123") as a post-login
// redirect target, rejecting protocol-relative ("//evil.example.com") or absolute
// ("https://evil.example.com") values that would otherwise enable an open redirect.
export function isSafeRedirectPath(value: string): boolean {
  return /^\/(?!\/)/.test(value);
}
