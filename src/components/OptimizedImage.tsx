import React, { useState, useCallback } from 'react';
import { ImageOptimizer } from '@/utils/performance';
import { Loader2 } from 'lucide-react';

interface OptimizedImageProps extends React.ImgHTMLAttributes<HTMLImageElement> {
  src: string;
  width?: number;
  height?: number;
  quality?: number;
  fallback?: string;
  showLoader?: boolean;
  sizes?: string;
  fit?: 'cover' | 'contain';
}

export function OptimizedImage({
  src,
  width,
  height,
  quality = 80,
  fallback = '/placeholder.svg',
  showLoader = true,
  sizes,
  fit = 'cover',
  className = '',
  alt = '',
  ...props
}: OptimizedImageProps) {
  const [isLoading, setIsLoading] = useState(true);
  const [hasError, setHasError] = useState(false);
  const [currentSrc, setCurrentSrc] = useState(src);

  // Update currentSrc when src prop changes
  React.useEffect(() => {
    setCurrentSrc(src);
    setHasError(false);
    setIsLoading(true);
  }, [src]);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
    setHasError(false);
  }, []);

  const handleError = useCallback(() => {
    console.error('Image failed to load:', currentSrc);
    setIsLoading(false);
    setHasError(true);
    if (currentSrc !== fallback) {
      console.log('Falling back to:', fallback);
      setCurrentSrc(fallback);
    }
  }, [currentSrc, fallback]);

  // Generate optimized URLs
  const optimizedSrc = ImageOptimizer.optimizeImageUrl(currentSrc, width, quality);
  const srcSet = sizes ? ImageOptimizer.generateSrcSet(currentSrc) : undefined;

  // Debug logging
  React.useEffect(() => {
    console.log('OptimizedImage rendered:', {
      originalSrc: src,
      currentSrc,
      optimizedSrc,
      hasError,
      isLoading
    });
  }, [src, currentSrc, optimizedSrc, hasError, isLoading]);

  return (
    <div className={`relative overflow-hidden ${className}`} style={{ width, height }}>
      {isLoading && showLoader && (
        <div className="absolute inset-0 flex items-center justify-center bg-muted/50">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      )}
      
      <img
        {...props}
        src={optimizedSrc}
        srcSet={srcSet}
        sizes={sizes}
        alt={alt}
        className={`transition-opacity duration-300 ${
          isLoading ? 'opacity-0' : 'opacity-100'
        } w-full h-full`}
        onLoad={handleLoad}
        onError={handleError}
        loading="lazy"
        decoding="async"
        style={{
          objectFit: hasError ? 'contain' : fit,
          objectPosition: 'center',
          width: '100%',
          height: '100%',
          maxWidth: '100%',
          maxHeight: '100%'
        }}
      />
    </div>
  );
}