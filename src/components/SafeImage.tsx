'use client';

import { useState, useEffect } from 'react';
import Image, { ImageProps } from 'next/image';
import { isAllowedImageSrc } from '@/lib/images/remoteImageHosts';

const DEFAULT_FALLBACK_SRC = '/file.svg';

interface SafeImageProps extends Omit<ImageProps, 'src' | 'onError'> {
  src?: string | null;
  fallbackSrc?: string;
  /**
   * Optional callback when fallback is used
   */
  onFallback?: () => void;
}

/**
 * Wraps next/image so a missing photo URL, an unlisted remote host, or a
 * broken/404 image can't crash the page — it degrades to a placeholder
 * instead of letting next/image throw its "hostname not configured" error.
 * 
 * ## Features
 * - Immediate fallback for missing/invalid URLs (no retry)
 * - Layout stability (no shift on error)
 * - Preserves alt text for accessibility
 * 
 * ## Note
 * For user/pet avatars with initials or species fallbacks, prefer the Avatar component.
 * Use SafeImage for general images like photos, banners, etc.
 */
export default function SafeImage({
  src,
  fallbackSrc = DEFAULT_FALLBACK_SRC,
  alt,
  onFallback,
  ...props
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  // Reset error state when src changes
  useEffect(() => {
    setHasError(false);
  }, [src]);

  const handleError = () => {
    if (hasError) return; // Don't call fallback again if already in error state
    setHasError(true);
    onFallback?.();
  };

  const resolvedSrc = !src || hasError || !isAllowedImageSrc(src) ? fallbackSrc : src;

  return <Image {...props} src={resolvedSrc} alt={alt} onError={handleError} />;
}
