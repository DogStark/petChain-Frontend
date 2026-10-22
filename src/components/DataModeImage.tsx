'use client';

import { useState } from 'react';
import { ImageIcon } from 'lucide-react';
import SafeImage from './SafeImage';
import { useDataMode } from '@/contexts/DataModeContext';
import { ImageProps } from 'next/image';

interface DataModeImageProps extends Omit<ImageProps, 'src' | 'onError'> {
  src?: string | null;
  fallbackSrc?: string;
  /**
   * Priority images (emergency, critical care) are always loaded regardless of mode.
   * Examples: emergency contact photos, critical medical alert badges
   */
  priority?: boolean;
  /**
   * Size category helps determine loading strategy
   */
  sizeCategory?: 'thumbnail' | 'medium' | 'large';
}

/**
 * Image component that respects reduced-data mode.
 * 
 * In reduced mode:
 * - Non-priority images show a placeholder with "Load Image" button
 * - Priority images (emergency/critical) load immediately
 * - Thumbnails load immediately (assumed small)
 * - User can opt-in to load specific images
 * 
 * Accessibility:
 * - Load buttons are keyboard accessible
 * - Screen readers announce deferred state
 * - Alt text preserved for all states
 */
export default function DataModeImage({
  src,
  fallbackSrc,
  priority = false,
  sizeCategory = 'medium',
  alt,
  ...props
}: DataModeImageProps) {
  const { isReducedMode } = useDataMode();
  const [userOptedIn, setUserOptedIn] = useState(false);

  // Determine if we should load the image
  const shouldLoad =
    !isReducedMode || // Full mode: always load
    priority || // Priority images: always load
    sizeCategory === 'thumbnail' || // Thumbnails: always load (small)
    userOptedIn; // User clicked "Load Image"

  const handleLoadImage = () => {
    setUserOptedIn(true);
  };

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      handleLoadImage();
    }
  };

  if (!shouldLoad) {
    // Show placeholder in reduced mode
    const containerClasses = props.fill
      ? 'absolute inset-0'
      : '';
    
    return (
      <div
        className={`${containerClasses} flex flex-col items-center justify-center bg-gradient-to-br from-gray-100 to-gray-200 rounded-lg border-2 border-dashed border-gray-300`}
        style={!props.fill ? { width: props.width, height: props.height } : undefined}
        role="img"
        aria-label={`${alt} (image deferred to save bandwidth)`}
      >
        <ImageIcon className="w-8 h-8 text-gray-400 mb-2" aria-hidden="true" />
        <button
          onClick={handleLoadImage}
          onKeyDown={handleKeyDown}
          className="px-3 py-1.5 text-sm font-medium text-blue-700 bg-white rounded-md shadow-sm border border-blue-200 hover:bg-blue-50 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-colors"
          aria-label={`Load image: ${alt}`}
        >
          Load Image
        </button>
        <p className="mt-1 text-xs text-gray-500 text-center px-2">
          Reduced data mode
        </p>
      </div>
    );
  }

  return (
    <SafeImage
      src={src}
      fallbackSrc={fallbackSrc}
      alt={alt}
      {...props}
    />
  );
}
