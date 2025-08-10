import React from 'react';
import { cn } from '@/lib/utils';
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from '@/components/ui/carousel';
import { OptimizedImage } from '@/components/OptimizedImage';

interface ProductImageGalleryProps {
  images?: string[];
  alt: string;
  containerClassName?: string; // e.g. "aspect-[4/3] sm:aspect-square"
  sizes?: string;
}

export function ProductImageGallery({
  images = [],
  alt,
  containerClassName = 'aspect-square',
  sizes = '(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw',
}: ProductImageGalleryProps) {
  const validImages = (images || []).filter(Boolean);

  // Fallback placeholder if no images
  if (!validImages.length) {
    return (
      <div className={cn('relative overflow-hidden bg-muted', containerClassName)}>
        <div className="w-full h-full flex items-center justify-center text-muted-foreground">
          No Image
        </div>
      </div>
    );
  }

  // Single image (no controls)
  if (validImages.length === 1) {
    return (
      <div className={cn('relative overflow-hidden bg-muted', containerClassName)}>
        <OptimizedImage
          src={validImages[0]}
          alt={alt}
          className="w-full h-full p-2"
          sizes={sizes}
          showLoader
          fit="contain"
        />
      </div>
    );
  }

  // Multiple images (carousel)
  return (
    <div className={cn('relative overflow-hidden bg-muted', containerClassName)}>
      <Carousel className="w-full h-full">
        <CarouselContent className="h-full">
          {validImages.map((src, idx) => (
            <CarouselItem key={idx} className="h-full">
              <div className="w-full h-full">
                <OptimizedImage
                  src={src}
                  alt={`${alt} - ${idx + 1}`}
                  className="w-full h-full p-2"
                  sizes={sizes}
                  showLoader
                  fit="contain"
                />
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        {/* subtle controls overlay */}
        <CarouselPrevious className="absolute left-2 top-1/2 -translate-y-1/2 bg-background/70 hover:bg-background/90 backdrop-blur px-2 py-1" />
        <CarouselNext className="absolute right-2 top-1/2 -translate-y-1/2 bg-background/70 hover:bg-background/90 backdrop-blur px-2 py-1" />
      </Carousel>
    </div>
  );
}
