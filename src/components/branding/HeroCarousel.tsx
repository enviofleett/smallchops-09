import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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
  const [isVisible, setIsVisible] = useState(true);

  // Fetch hero images with optimized loading
  const { data: heroImages = [] } = useQuery({
    queryKey: ['hero-images-public', Date.now()], // Force fresh fetch
    queryFn: async () => {
      const { data, error } = await supabase
        .from('hero_carousel_images')
        .select('*')
        .eq('is_active', true)
        .order('display_order', { ascending: true });
      
      if (error) {
        console.error('Error fetching hero images:', error);
        return [];
      }
      return data as HeroImage[];
    },
    staleTime: 0, // No stale time - always fresh
    gcTime: 0, // No cache
    refetchOnMount: true,
    refetchOnWindowFocus: true
  });

  // Preload all hero images for instant loading
  useEffect(() => {
    if (heroImages.length > 0) {
      heroImages.forEach((image, index) => {
        const img = new Image();
        img.src = image.image_url;
        if (index === 0) {
          // Highest priority for first image
          img.fetchPriority = 'high';
        }
      });
    }
  }, [heroImages]);

  // Only show uploaded images - no hardcoded fallbacks
  const imagesToShow = heroImages.length > 0 ? heroImages : [];

  // Auto-rotate images every 20 seconds with fade effect
  useEffect(() => {
    if (imagesToShow.length <= 1) return;

    const interval = setInterval(() => {
      // Start fade out
      setIsVisible(false);
      
      // After fade out completes, change image and fade in
      setTimeout(() => {
        setCurrentIndex((prevIndex) => 
          (prevIndex + 1) % imagesToShow.length
        );
        setIsVisible(true);
      }, 500); // 500ms fade out duration
    }, 20000); // 20 seconds

    return () => clearInterval(interval);
  }, [imagesToShow.length]);

  // Reset visibility when component mounts or images change
  useEffect(() => {
    setIsVisible(true);
    setCurrentIndex(0);
  }, [imagesToShow]);

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
      <img 
        src={currentImage.image_url} 
        alt={currentImage.alt_text || 'Uploaded product image'} 
        className={`w-full h-full object-cover rounded-2xl transition-opacity duration-500 ease-in-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        loading="eager"
        fetchPriority="high"
        decoding="async"
        onError={(e) => {
          console.error('Failed to load hero image:', currentImage.image_url);
          // Don't fallback to any hardcoded image
          const target = e.target as HTMLImageElement;
          target.style.display = 'none';
        }}
      />
    </div>
  );
};