import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import heroPlaceholder from '@/assets/hero-placeholder.jpg';

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

  // Fetch hero images with stable caching
  const { data: heroImages = [] } = useQuery({
    queryKey: ['hero-images-public'],
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
    staleTime: 10 * 60 * 1000, // 10 minutes
    gcTime: 30 * 60 * 1000, // 30 minutes
    refetchOnWindowFocus: false
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

  // Auto-rotate images every 8 seconds with smooth fade effect
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
      }, 300); // 300ms fade out duration
    }, 8000); // 8 seconds

    return () => clearInterval(interval);
  }, [imagesToShow.length]);

  // Reset visibility when component mounts or images change
  useEffect(() => {
    setIsVisible(true);
    setCurrentIndex(0);
  }, [imagesToShow]);

  // Use first available hero image as fallback
  if (imagesToShow.length === 0) {
    return (
      <div className={className}>
        <img 
          src="https://oknnklksdiqaifhxaccs.supabase.co/storage/v1/object/public/hero-images/hero-1757891367984-6626d388.jpg"
          alt="Hero showcase" 
          className="w-full h-full object-cover rounded-2xl"
          loading="eager"
          fetchPriority="high"
        />
      </div>
    );
  }

  const currentImage = imagesToShow[currentIndex];

  return (
    <div className={className}>
      <img 
        src={currentImage.image_url} 
        alt={currentImage.alt_text || 'Uploaded product image'} 
        className={`w-full h-full object-cover rounded-2xl transition-all duration-300 ease-in-out ${
          isVisible ? 'opacity-100 animate-fade-in' : 'opacity-0 animate-fade-out'
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