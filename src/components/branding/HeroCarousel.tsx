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
  fallbackImage = "/lovable-uploads/6ce07f82-8658-4534-a584-2c507d3ff58c.png",
  fallbackAlt = "Delicious snacks and treats"
}: HeroCarouselProps) => {
  const [currentIndex, setCurrentIndex] = useState(0);
  const [isVisible, setIsVisible] = useState(true);

  // Fetch hero images
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
  });

  // Use fallback if no hero images available
  const imagesToShow = heroImages.length > 0 ? heroImages : [
    { 
      id: 'fallback', 
      image_url: fallbackImage, 
      alt_text: fallbackAlt, 
      display_order: 0, 
      is_active: true 
    }
  ];

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

  const currentImage = imagesToShow[currentIndex];

  return (
    <div className={className}>
      <img 
        src={currentImage.image_url} 
        alt={currentImage.alt_text || 'Hero image'} 
        className={`w-full h-full object-cover rounded-2xl transition-opacity duration-500 ease-in-out ${
          isVisible ? 'opacity-100' : 'opacity-0'
        }`}
        loading="eager"
        onError={(e) => {
          // Fallback to default image if current image fails to load
          const target = e.target as HTMLImageElement;
          if (target.src !== fallbackImage) {
            target.src = fallbackImage;
            target.alt = fallbackAlt;
          }
        }}
      />
    </div>
  );
};