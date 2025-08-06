import { useEffect } from 'react';
import { ResourcePreloader } from '@/utils/performance';

export function useImagePreloader(images: string[]) {
  useEffect(() => {
    if (images.length > 0) {
      ResourcePreloader.preloadImages(images);
    }
  }, [images]);
}

export function useRoutePreloader(routes: string[]) {
  useEffect(() => {
    routes.forEach(route => ResourcePreloader.preloadRoute(route));
  }, [routes]);
}