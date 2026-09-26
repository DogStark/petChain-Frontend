'use client';

import React, { useState, useEffect } from 'react';
import Image from 'next/image';
import { isAllowedImageSrc } from '@/lib/images/remoteImageHosts';
import styles from './Avatar.module.css';

export interface AvatarProps {
  /**
   * URL of the avatar image
   */
  src?: string | null;
  
  /**
   * Alt text for the image. For decorative avatars (in lists, menus),
   * use an empty string. For meaningful avatars (profile pages),
   * describe the subject (e.g., "John Doe's profile picture")
   */
  alt: string;
  
  /**
   * Display name for generating initials fallback
   */
  name?: string;
  
  /**
   * Species for pet avatars (used for icon fallback)
   */
  species?: 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
  
  /**
   * Size in pixels
   */
  size?: number;
  
  /**
   * Shape of the avatar
   */
  shape?: 'circle' | 'rounded' | 'square';
  
  /**
   * Additional CSS classes
   */
  className?: string;
  
  /**
   * Loading priority for next/image
   */
  priority?: boolean;
}

/**
 * Avatar component with robust fallback handling for broken/missing images.
 * 
 * ## Features
 * - Deterministic initials/species fallback
 * - No layout shift on image error
 * - Proper alt-text semantics
 * - Retry-free (immediate fallback)
 * - Localized error handling
 * 
 * ## Usage
 * ```tsx
 * // User avatar with initials fallback
 * <Avatar src={user.avatarUrl} alt="User profile picture" name="John Doe" size={48} />
 * 
 * // Pet avatar with species fallback
 * <Avatar src={pet.avatarUrl} alt="" name={pet.name} species="dog" size={64} />
 * 
 * // Decorative avatar (empty alt)
 * <Avatar src={user.avatarUrl} alt="" name={user.name} size={32} />
 * ```
 */
export function Avatar({
  src,
  alt,
  name,
  species,
  size = 48,
  shape = 'circle',
  className = '',
  priority = false,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [mounted, setMounted] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setImageError(false);
  }, [src]);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Determine if we should show the image or fallback
  const shouldShowImage =
    !imageError && src && isAllowedImageSrc(src) && mounted;

  const shapeClass = shape === 'circle' 
    ? styles.circle 
    : shape === 'rounded' 
    ? styles.rounded 
    : styles.square;

  const containerStyle: React.CSSProperties = {
    width: `${size}px`,
    height: `${size}px`,
    minWidth: `${size}px`,
    minHeight: `${size}px`,
  };

  return (
    <div
      className={`${styles.avatar} ${shapeClass} ${className}`}
      style={containerStyle}
      role="img"
      aria-label={alt || undefined}
    >
      {shouldShowImage ? (
        <Image
          src={src}
          alt={alt}
          fill
          sizes={`${size}px`}
          className={styles.image}
          style={{ objectFit: 'cover' }}
          onError={() => setImageError(true)}
          priority={priority}
        />
      ) : (
        <AvatarFallback name={name} species={species} size={size} />
      )}
    </div>
  );
}

interface AvatarFallbackProps {
  name?: string;
  species?: 'dog' | 'cat' | 'bird' | 'rabbit' | 'other';
  size: number;
}

/**
 * Deterministic fallback for avatars.
 * Shows initials for users or species icon for pets.
 */
function AvatarFallback({ name, species, size }: AvatarFallbackProps) {
  const fontSize = Math.max(12, size * 0.4);
  const iconSize = Math.max(16, size * 0.5);

  if (species) {
    return (
      <div className={styles.fallback} style={{ fontSize: `${iconSize}px` }}>
        {getSpeciesIcon(species)}
      </div>
    );
  }

  if (name) {
    const initials = getInitials(name);
    return (
      <div className={styles.fallback} style={{ fontSize: `${fontSize}px` }}>
        {initials}
      </div>
    );
  }

  // Ultimate fallback - generic user icon
  return (
    <div className={styles.fallback} style={{ fontSize: `${iconSize}px` }}>
      <svg
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ width: `${iconSize}px`, height: `${iconSize}px` }}
      >
        <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
        <circle cx="12" cy="7" r="4" />
      </svg>
    </div>
  );
}

/**
 * Extract initials from a name (max 2 characters)
 */
function getInitials(name: string): string {
  if (!name) return '?';
  
  const parts = name.trim().split(/\s+/);
  
  if (parts.length === 1) {
    // Single name: take first 2 chars
    return parts[0].slice(0, 2).toUpperCase();
  }
  
  // Multiple names: take first char of first and last
  return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
}

/**
 * Get species-specific icon/emoji
 */
function getSpeciesIcon(species: string): string {
  const icons: Record<string, string> = {
    dog: '🐕',
    cat: '🐈',
    bird: '🐦',
    rabbit: '🐇',
    other: '🐾',
  };
  
  return icons[species.toLowerCase()] || icons.other;
}
