import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';

export interface FavoriteProduct {
  favorite_id: string;
  product_id: string;
  product_name: string;
  product_price: number;
  product_image_url: string | null;
  product_status: string;
  created_at: string;
}

interface ToggleFavoriteResponse {
  success: boolean;
  is_favorite: boolean;
  action: string;
  message: string;
  error?: string;
}

export const useFavorites = () => {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  // Fetch user's favorites
  const fetchFavorites = async () => {
    try {
      setIsLoading(true);
      setError(null);

      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        setFavorites([]);
        return;
      }

      const { data, error } = await supabase.rpc('get_user_favorites_with_products');
      
      if (error) {
        console.error('Error fetching favorites:', error);
        setError('Failed to load favorites');
        toast({
          title: "Error",
          description: "Failed to load your favorites. Please try again.",
          variant: "destructive",
        });
        return;
      }

      setFavorites(data || []);
    } catch (err) {
      console.error('Unexpected error fetching favorites:', err);
      setError('Unexpected error occurred');
    } finally {
      setIsLoading(false);
    }
  };

  // Check if a product is in favorites
  const isFavorite = (productId: string): boolean => {
    return favorites.some(fav => fav.product_id === productId);
  };

  // Toggle favorite status
  const toggleFavorite = async (productId: string): Promise<boolean> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        toast({
          title: "Authentication Required",
          description: "Please sign in to add products to your favorites.",
          variant: "destructive",
        });
        return false;
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
        return false;
      }

      const response = data as unknown as ToggleFavoriteResponse;
      if (response?.success) {
        // Update local state immediately for better UX
        if (response.is_favorite) {
          // Product was added to favorites - we don't have full product details here
          // so we'll refetch to get the complete data
          await fetchFavorites();
        } else {
          // Product was removed from favorites
          setFavorites(prev => prev.filter(fav => fav.product_id !== productId));
        }

        toast({
          title: response.is_favorite ? "Added to Favorites" : "Removed from Favorites",
          description: response.message,
          variant: "default",
        });

        return response.is_favorite;
      }

      return false;
    } catch (err) {
      console.error('Unexpected error toggling favorite:', err);
      toast({
        title: "Error",
        description: "An unexpected error occurred. Please try again.",
        variant: "destructive",
      });
      return false;
    }
  };

  // Remove favorite by favorite ID
  const removeFavorite = async (productId: string): Promise<boolean> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        toast({
          title: "Authentication Required", 
          description: "Please sign in to manage your favorites.",
          variant: "destructive",
        });
        return false;
      }

      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('product_id', productId)
        .eq('user_id', session.session.user.id);

      if (error) {
        console.error('Error removing favorite:', error);
        toast({
          title: "Error",
          description: "Failed to remove from favorites. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      // Update local state
      setFavorites(prev => prev.filter(fav => fav.product_id !== productId));
      
      toast({
        title: "Removed from Favorites",
        description: "Product has been removed from your favorites.",
        variant: "default",
      });

      return true;
    } catch (err) {
      console.error('Unexpected error removing favorite:', err);
      return false;
    }
  };

  // Clear all favorites
  const clearAllFavorites = async (): Promise<boolean> => {
    try {
      const { data: session } = await supabase.auth.getSession();
      if (!session.session?.user) {
        return false;
      }

      const { error } = await supabase
        .from('user_favorites')
        .delete()
        .eq('user_id', session.session.user.id);

      if (error) {
        console.error('Error clearing favorites:', error);
        toast({
          title: "Error",
          description: "Failed to clear favorites. Please try again.",
          variant: "destructive",
        });
        return false;
      }

      setFavorites([]);
      toast({
        title: "Favorites Cleared",
        description: "All favorites have been removed.",
        variant: "default",
      });

      return true;
    } catch (err) {
      console.error('Unexpected error clearing favorites:', err);
      return false;
    }
  };

  // Get favorites count
  const getFavoritesCount = (): number => {
    return favorites.length;
  };

  // Initialize favorites on mount
  useEffect(() => {
    fetchFavorites();
  }, []);

  // Listen for auth state changes
  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === 'SIGNED_IN' && session?.user) {
        fetchFavorites();
      } else if (event === 'SIGNED_OUT') {
        setFavorites([]);
        setIsLoading(false);
        setError(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  return {
    favorites,
    isLoading,
    error,
    isFavorite,
    toggleFavorite,
    removeFavorite,
    clearAllFavorites,
    getFavoritesCount,
    refetch: fetchFavorites,
  };
};