import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { OptimizedImage } from '@/components/OptimizedImage';

interface HeroImage {
  id: string;
  image_url: string;
  alt_text?: string;
  display_order: number;
  is_active: boolean;
}

interface HeroCarouselProps {
  className?: string;
  fallbackImage?: string;
  fallbackAlt?: string;
}

export const HeroCarousel = ({ 
  className = "w-64 h-64 sm:w-80 sm:h-80 lg:w-96 lg:h-96",
  fallbackImage,
  fallbackAlt = "Product showcase"
}: HeroCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // Fetch hero images
  const { data: heroImages = [], error: queryError, isLoading, isError } = useQuery({
    queryKey: ['hero-images-public'],
    queryFn: async () => {
      console.log('Fetching hero images...');
      const { data, error } = await supabase
        .from('hero_carousel_images')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) {
        console.error('Error fetching hero images:', error);
        throw error;
      }
      
      console.log('Hero images fetched:', data?.length || 0, 'images');
      return data as HeroImage[];
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    retry: 3,
    refetchOnWindowFocus: false,
  });

  // Log query state for debugging
  useEffect(() => {
    if (isError) {
      console.error('Hero images query error:', queryError);
    }
    if (isLoading) {
      console.log('Loading hero images...');
    }
    if (!isLoading && !isError) {
      console.log('Hero images loaded successfully:', heroImages.length);
    }
  }, [isLoading, isError, queryError, heroImages.length]);

  // Only show uploaded images - no hardcoded fallbacks
  const imagesToShow = heroImages.length > 0 ? heroImages : [];

  // Auto-rotate images every 20 seconds with smooth fade effect
  useEffect(() => {
    if (imagesToShow.length <= 1) return;

    const interval = setInterval(() => {
      setIsTransitioning(true);
      
      // Change image after fade out duration
      setTimeout(() => {
        setCurrentIndex((prevIndex) => 
          (prevIndex + 1) % imagesToShow.length
        );
        setIsTransitioning(false);
      }, 500); // Match CSS transition duration
    }, 20000); // 20 seconds

    return () => clearInterval(interval);
  }, [imagesToShow.length]);

  // Reset state when images change
  useEffect(() => {
    setCurrentIndex(0);
    setIsTransitioning(false);
  }, [imagesToShow]);

  // Don't render anything if loading or error occurred
  if (isLoading) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-2xl`}>
        <div className="text-center p-6">
          <div className="text-gray-400 text-sm font-medium">
            Loading images...
          </div>
        </div>
      </div>
    );
  }

  if (isError) {
    return (
      <div className={`${className} flex items-center justify-center bg-red-50 rounded-2xl`}>
        <div className="text-center p-6">
          <div className="text-red-500 text-sm font-medium">
            Error loading images
          </div>
          <div className="text-red-400 text-xs mt-1">
            {queryError?.message || 'Unknown error'}
          </div>
        </div>
      </div>
    );
  }

  // Don't render anything if no uploaded images available
  if (imagesToShow.length === 0) {
    return (
      <div className={`${className} flex items-center justify-center bg-gray-100 rounded-2xl`}>
        <div className="text-center p-6">
          <div className="text-gray-400 text-sm font-medium">
            Upload images to showcase your products
          </div>
        </div>
      </div>
    );
  }

  const currentImage = imagesToShow[currentIndex];

  return (
    <div className={className}>
      <OptimizedImage
        src={currentImage.image_url}
        alt={currentImage.alt_text || 'Uploaded product image'}
        className={`w-full h-full object-cover rounded-2xl transition-opacity duration-500 ease-in-out ${
          isTransitioning ? 'opacity-0' : 'opacity-100'
        }`}
        showLoader={true}
        fit="cover"
        sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
      />
    </div>
  );
};