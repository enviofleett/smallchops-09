import React from 'react';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { HeaderBanner as HeaderBannerType } from '@/hooks/useHeaderBanners';

interface HeaderBannerProps {
  banner: HeaderBannerType;
  onDismiss?: () => void;
  dismissible?: boolean;
}

export const HeaderBanner: React.FC<HeaderBannerProps> = ({ 
  banner, 
  onDismiss, 
  dismissible = true 
}) => {
  const backgroundStyle = {
    backgroundColor: banner.background_color,
    color: banner.text_color,
  };

  return (
    <div 
      className="relative w-full py-3 px-4 text-center"
      style={backgroundStyle}
    >
      {banner.image_url && (
        <div 
          className="absolute inset-0 bg-cover bg-center opacity-20"
          style={{ backgroundImage: `url(${banner.image_url})` }}
        />
      )}
      
      <div className="relative z-10 container mx-auto flex items-center justify-center gap-4">
        <div className="flex-1 flex items-center justify-center gap-4">
          <div>
            <h3 className="font-semibold text-sm md:text-base">{banner.title}</h3>
            {banner.description && (
              <p className="text-xs md:text-sm opacity-90">{banner.description}</p>
            )}
          </div>
          
          {banner.button_text && banner.button_url && (
            <Button
              variant="outline"
              size="sm"
              className="border-current text-current hover:bg-current hover:text-background"
              onClick={() => window.open(banner.button_url, '_blank')}
            >
              {banner.button_text}
            </Button>
          )}
        </div>

        {dismissible && onDismiss && (
          <Button
            variant="ghost"
            size="icon"
            className="h-6 w-6 text-current hover:bg-current/20"
            onClick={onDismiss}
          >
            <X className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
};