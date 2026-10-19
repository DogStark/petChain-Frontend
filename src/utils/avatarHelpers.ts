/**
 * Avatar fallback utilities: initials extraction, deterministic color generation,
 * and species icon mapping for pet avatars.
 */

/**
 * Extracts initials from a name (1-2 characters).
 * Examples: "John Doe" -> "JD", "Alice" -> "A", "Dr. Bob Smith" -> "BS"
 */
export function getInitials(name: string): string {
  if (!name || typeof name !== 'string') return '?';
  
  const trimmed = name.trim();
  if (!trimmed) return '?';
  
  // Split by whitespace and filter out empty parts
  const parts = trimmed.split(/\s+/).filter(Boolean);
  
  if (parts.length === 0) return '?';
  if (parts.length === 1) {
    // Single name: take first character
    return parts[0].charAt(0).toUpperCase();
  }
  
  // Multiple parts: take first character of first and last part
  const first = parts[0].charAt(0).toUpperCase();
  const last = parts[parts.length - 1].charAt(0).toUpperCase();
  return first + last;
}

/**
 * Generates a deterministic background color from a string.
 * Same input always produces same color (useful for consistent avatars).
 */
export function getAvatarColor(input: string): string {
  if (!input || typeof input !== 'string') {
    return '#9CA3AF'; // gray-400 fallback
  }
  
  // Predefined color palette (accessible, distinct colors)
  const colors = [
    '#EF4444', // red-500
    '#F59E0B', // amber-500
    '#10B981', // emerald-500
    '#3B82F6', // blue-500
    '#8B5CF6', // violet-500
    '#EC4899', // pink-500
    '#06B6D4', // cyan-500
    '#84CC16', // lime-500
    '#F97316', // orange-500
    '#6366F1', // indigo-500
  ];
  
  // Simple hash function for deterministic color selection
  let hash = 0;
  for (let i = 0; i < input.length; i++) {
    hash = input.charCodeAt(i) + ((hash << 5) - hash);
    hash = hash & hash; // Convert to 32-bit integer
  }
  
  const index = Math.abs(hash) % colors.length;
  return colors[index];
}

/**
 * Maps pet species to icon names (for use with lucide-react).
 */
export function getSpeciesIcon(species?: string): 'dog' | 'cat' | 'bird' | 'fish' | 'rabbit' | 'paw-print' {
  if (!species) return 'paw-print';
  
  const normalized = species.toLowerCase().trim();
  
  switch (normalized) {
    case 'dog':
    case 'canine':
      return 'dog';
    case 'cat':
    case 'feline':
      return 'cat';
    case 'bird':
    case 'avian':
      return 'bird';
    case 'fish':
    case 'aquatic':
      return 'fish';
    case 'rabbit':
    case 'bunny':
      return 'rabbit';
    default:
      return 'paw-print';
  }
}

/**
 * Determines if an alt text should be empty (decorative) or descriptive.
 * Empty alt for decorative images prevents screen readers from announcing redundant info.
 */
export function getAvatarAlt(
  name: string,
  type: 'user' | 'pet' | 'staff',
  isDecorative: boolean = false
): string {
  if (isDecorative) return '';
  
  const typeLabel = type === 'user' ? 'Profile' : type === 'pet' ? 'Pet' : 'Staff member';
  return name ? `${typeLabel} picture for ${name}` : `${typeLabel} picture`;
}
