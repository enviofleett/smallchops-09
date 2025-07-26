import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { addProductToFavorites, removeProductFromFavorites, getCustomerFavorites, checkIsFavorite, getFavoritesByProductIds } from '@/api/favorites';
import { useToast } from '@/hooks/use-toast';

export const useCustomerFavorites = (customerId?: string) => {
  const queryClient = useQueryClient();
  const { toast } = useToast();

  // Get all customer favorites
  const favoritesQuery = useQuery({
    queryKey: ['customer-favorites', customerId],
    queryFn: () => customerId ? getCustomerFavorites(customerId) : Promise.resolve([]),
    enabled: !!customerId,
  });

  // Add to favorites
  const addFavoriteMutation = useMutation({
    mutationFn: ({ customerId, productId }: { customerId: string; productId: string }) =>
      addProductToFavorites(customerId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-favorites'] });
      queryClient.invalidateQueries({ queryKey: ['is-favorite'] });
      queryClient.invalidateQueries({ queryKey: ['favorites-by-products'] });
      toast({
        title: "Added to favorites",
        description: "Product has been added to your favorites",
      });
    },
    onError: (error: Error) => {
      toast({
        variant: "destructive",
        title: "Error",
        description: error.message === 'Product is already in favorites' 
          ? "This product is already in your favorites"
          : "Failed to add product to favorites",
      });
    },
  });

  // Remove from favorites
  const removeFavoriteMutation = useMutation({
    mutationFn: ({ customerId, productId }: { customerId: string; productId: string }) =>
      removeProductFromFavorites(customerId, productId),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['customer-favorites'] });
      queryClient.invalidateQueries({ queryKey: ['is-favorite'] });
      queryClient.invalidateQueries({ queryKey: ['favorites-by-products'] });
      toast({
        title: "Removed from favorites",
        description: "Product has been removed from your favorites",
      });
    },
    onError: () => {
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove product from favorites",
      });
    },
  });

  return {
    favorites: favoritesQuery.data || [],
    isLoading: favoritesQuery.isLoading,
    isError: favoritesQuery.isError,
    error: favoritesQuery.error,
    addToFavorites: addFavoriteMutation.mutate,
    removeFromFavorites: removeFavoriteMutation.mutate,
    isAddingFavorite: addFavoriteMutation.isPending,
    isRemovingFavorite: removeFavoriteMutation.isPending,
  };
};

export const useIsFavorite = (customerId?: string, productId?: string) => {
  return useQuery({
    queryKey: ['is-favorite', customerId, productId],
    queryFn: () => customerId && productId ? checkIsFavorite(customerId, productId) : Promise.resolve(false),
    enabled: !!customerId && !!productId,
  });
};

export const useFavoritesByProducts = (customerId?: string, productIds?: string[]) => {
  return useQuery({
    queryKey: ['favorites-by-products', customerId, productIds],
    queryFn: () => customerId && productIds?.length ? getFavoritesByProductIds(customerId, productIds) : Promise.resolve({}),
    enabled: !!customerId && !!productIds?.length,
  });
};