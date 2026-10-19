'use client';

import { useState, CSSProperties } from 'react';
import Image, { ImageProps } from 'next/image';
import { isAllowedImageSrc } from '@/lib/images/remoteImageHosts';

const DEFAULT_FALLBACK_SRC = '/file.svg';

interface SafeImageProps extends Omit<ImageProps, 'src' | 'onError'> {
  src?: string | null;
  fallbackSrc?: string;
}

/**
 * Wraps next/image so a missing photo URL, an unlisted remote host, or a
 * broken/404 image can't crash the page — it degrades to a placeholder
 * instead of letting next/image throw its "hostname not configured" error.
 * 
 * Layout shift prevention:
 * - When using `fill`, the parent container maintains dimensions
 * - When using width/height props, dimensions are stable
 * - Loading states don't cause reflow
 */
export default function SafeImage({
  src,
  fallbackSrc = DEFAULT_FALLBACK_SRC,
  alt,
  style,
  ...props
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  const resolvedSrc = !src || hasError || !isAllowedImageSrc(src) ? fallbackSrc : src;

  // Enhance style to prevent layout shifts
  const enhancedStyle: CSSProperties = {
    ...style,
    // Ensure smooth transitions without layout shifts
    transition: isLoading ? 'none' : 'opacity 0.2s ease-in-out',
  };

  return (
    <Image
      {...props}
      src={resolvedSrc}
      alt={alt}
      style={enhancedStyle}
      onError={() => {
        setHasError(true);
        setIsLoading(false);
      }}
      onLoad={() => setIsLoading(false)}
    />
  );
}
