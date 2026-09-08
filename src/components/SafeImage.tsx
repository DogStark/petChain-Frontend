'use client';

import { useState } from 'react';
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
 */
export default function SafeImage({
  src,
  fallbackSrc = DEFAULT_FALLBACK_SRC,
  alt,
  ...props
}: SafeImageProps) {
  const [hasError, setHasError] = useState(false);

  const resolvedSrc = !src || hasError || !isAllowedImageSrc(src) ? fallbackSrc : src;

  return <Image {...props} src={resolvedSrc} alt={alt} onError={() => setHasError(true)} />;
}
