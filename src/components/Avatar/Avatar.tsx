'use client';

import { useState } from 'react';
import Image from 'next/image';
import { Dog, Cat, Bird, Fish, Rabbit, PawPrint, User } from 'lucide-react';
import { isAllowedImageSrc } from '@/lib/images/remoteImageHosts';
import { getInitials, getAvatarColor, getSpeciesIcon, getAvatarAlt } from '@/utils/avatarHelpers';
import styles from './Avatar.module.css';

export interface AvatarProps {
  /** Image source URL */
  src?: string | null;
  /** Name for initials fallback and alt text */
  name?: string;
  /** Avatar type: user, pet, or staff */
  type?: 'user' | 'pet' | 'staff';
  /** Pet species (for pet avatars only) */
  species?: string;
  /** Size in pixels (default: 48) */
  size?: number;
  /** Custom class name */
  className?: string;
  /** Whether the image is decorative (affects alt text) */
  isDecorative?: boolean;
  /** Optional priority for Next.js Image loading */
  priority?: boolean;
  /** Optional sizes attribute for responsive images */
  sizes?: string;
}

/**
 * Avatar component with automatic fallback handling.
 * - Shows image if available and valid
 * - Falls back to initials for user/staff avatars
 * - Falls back to species icon for pet avatars
 * - Prevents layout shift with stable dimensions
 * - Uses proper alt text based on context
 */
export default function Avatar({
  src,
  name = '',
  type = 'user',
  species,
  size = 48,
  className = '',
  isDecorative = false,
  priority = false,
  sizes,
}: AvatarProps) {
  const [imageError, setImageError] = useState(false);
  const [imageLoaded, setImageLoaded] = useState(false);

  // Determine if we should show the image or fallback
  const shouldShowImage =
    src && !imageError && isAllowedImageSrc(src) && typeof src === 'string' && src.trim() !== '';

  // Generate fallback content
  const initials = getInitials(name);
  const bgColor = getAvatarColor(name || species || 'default');
  const altText = getAvatarAlt(name, type, isDecorative);

  // Render fallback (initials or icon)
  const renderFallback = () => {
    if (type === 'pet') {
      const iconName = getSpeciesIcon(species);
      const iconSize = Math.floor(size * 0.5);
      const IconComponent = {
        dog: Dog,
        cat: Cat,
        bird: Bird,
        fish: Fish,
        rabbit: Rabbit,
        'paw-print': PawPrint,
      }[iconName];

      return (
        <div
          className={styles.fallback}
          style={{
            width: size,
            height: size,
            backgroundColor: bgColor,
          }}
          role="img"
          aria-label={altText || undefined}
        >
          <IconComponent size={iconSize} className={styles.icon} />
        </div>
      );
    }

    // User or staff: show initials
    return (
      <div
        className={styles.fallback}
        style={{
          width: size,
          height: size,
          backgroundColor: bgColor,
          fontSize: Math.floor(size * 0.4),
        }}
        role="img"
        aria-label={altText || undefined}
      >
        <span className={styles.initials}>{initials}</span>
      </div>
    );
  };

  return (
    <div className={`${styles.container} ${className}`} style={{ width: size, height: size }}>
      {shouldShowImage ? (
        <>
          <Image
            src={src}
            alt={altText}
            fill
            sizes={sizes || `${size}px`}
            className={`${styles.image} ${imageLoaded ? styles.loaded : ''}`}
            style={{ objectFit: 'cover' }}
            onError={() => setImageError(true)}
            onLoad={() => setImageLoaded(true)}
            priority={priority}
            unoptimized={src.startsWith('blob:') || src.startsWith('data:')}
          />
          {/* Show fallback while loading */}
          {!imageLoaded && (
            <div className={styles.loadingFallback}>{renderFallback()}</div>
          )}
        </>
      ) : (
        renderFallback()
      )}
    </div>
  );
}
