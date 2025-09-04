import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

interface ToggleFavoriteResponse {
  success: boolean;
  is_favorite: boolean;
  action: string;
  message: string;
  error?: string;
}

export const useProductFavorite = (productId: string) => {
  const [isFavorite, setIsFavorite] = useState<boolean>(false);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const { toast } = useToast();

  // Check if product is favorited
  const checkFavoriteStatus = async () => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        setIsFavorite(false);
        return;
      }

      const { data, error } = await supabase
        .from('user_favorites')
        .select('id')
        .eq('user_id', session.session.user.id)
        .eq('product_id', productId)
        .limit(1);

      if (error) {
        console.error('Error checking favorite status:', error);
        return;
      }

      setIsFavorite(data && data.length > 0);
    } catch (err) {
      console.error('Unexpected error checking favorite status:', err);
    }
  };

  // Toggle favorite status
  const toggleFavorite = async (): Promise<void> => {
    try {
      setIsLoading(true);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to add products to your favorites.",
          variant: "destructive",
        });
        return;
      }

      const { data, error } = await supabase.rpc('toggle_user_favorite', {
        p_product_id: productId
      });

      if (error) {
        console.error('Error toggling favorite:', error);
        toast({
          title: "Error",
          description: "Failed to update favorites. Please try again.",
          variant: "destructive",
        });
        return;
      }

      const response = data as unknown as ToggleFavoriteResponse;
      if (response?.success) {
        setIsFavorite(response.is_favorite);
        toast({
          title: response.is_favorite ? "Added to Favorites" : "Removed from Favorites",
          description: response.message,
          variant: "default",
        });
      } else {
        toast({
          title: "Error",
          description: response?.message || "Failed to update favorites",
          variant: "destructive",
        });
      }
    } catch (err) {
      console.error('Unexpected error toggling favorite:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  // Initialize favorite status
  useEffect(() => {
    if (productId) {
      checkFavoriteStatus();
    }
  }, [productId]);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        checkFavoriteStatus();
      } else if (event === 'SIGNED_OUT') {
        setIsFavorite(false);
      }
    });

    return () => subscription.unsubscribe();
  }, [productId]);

  return {
    isFavorite,
    isLoading,
    toggleFavorite,
  };
};