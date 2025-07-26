import { useEffect, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Heart, Plus, AlertCircle } from 'lucide-react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { FavoriteProduct } from '@/api/favorites';
import { publicAPI } from '@/api/public';
import { useToast } from '@/hooks/use-toast';

interface FavoritesSectionProps {
  customerId: string | null;
}

export const FavoritesSection = ({ customerId }: FavoritesSectionProps) => {
  const [favorites, setFavorites] = useState<FavoriteProduct[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const { toast } = useToast();

  useEffect(() => {
    const loadFavorites = async () => {
      if (!customerId) return;
      
      setIsLoading(true);
      setError(null);
      
      try {
        const response = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-api/customers/${customerId}/favorites`);
        
        if (!response.ok) {
          throw new Error(`Failed to load favorites: ${response.statusText}`);
        }
        
        const data = await response.json();
        setFavorites(data.data || []);
      } catch (err) {
        console.error('Error loading favorites:', err);
        setError(err instanceof Error ? err.message : 'Failed to load favorites');
      } finally {
        setIsLoading(false);
      }
    };

    loadFavorites();
  }, [customerId]);

  const handleRemoveFromFavorites = async (productId: string) => {
    if (!customerId) return;
    
    try {
      const response = await fetch(
        `https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/public-api/customers/${customerId}/favorites/${productId}`,
        { method: 'DELETE' }
      );
      
      if (!response.ok) {
        throw new Error('Failed to remove from favorites');
      }
      
      setFavorites(prev => prev.filter(item => item.id !== productId));
      
      toast({
        title: "Removed from favorites",
        description: "Product has been removed from your favorites",
      });
    } catch (err) {
      console.error('Error removing favorite:', err);
      toast({
        variant: "destructive",
        title: "Error",
        description: "Failed to remove product from favorites",
      });
    }
  };

  if (!customerId) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            My Favorite Products
          </CardTitle>
          <CardDescription>Products you've saved for later</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Please log in to view your favorite products.
            </AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  if (isLoading) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            My Favorite Products
          </CardTitle>
          <CardDescription>Products you've saved for later</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="text-center py-12">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading your favorites...</p>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (error) {
    return (
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Heart className="h-5 w-5" />
            My Favorite Products
          </CardTitle>
          <CardDescription>Products you've saved for later</CardDescription>
        </CardHeader>
        <CardContent>
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Heart className="h-5 w-5" />
          My Favorite Products
        </CardTitle>
        <CardDescription>Products you've saved for later</CardDescription>
      </CardHeader>
      <CardContent>
        {favorites.length === 0 ? (
          <div className="text-center py-12">
            <Heart className="w-12 h-12 mx-auto text-muted-foreground mb-4" />
            <h4 className="text-lg font-semibold mb-2">No favorites yet</h4>
            <p className="text-muted-foreground mb-4">
              Start adding products to your favorites to see them here
            </p>
            <Button>Browse Products</Button>
          </div>
        ) : (
          <div className="grid gap-4 md:grid-cols-2">
            {favorites.map((item) => (
              <Card key={item.id} className="p-4">
                <div className="flex items-center space-x-4">
                  <img 
                    src={item.image_url || '/placeholder.svg'} 
                    alt={item.name}
                    className="w-16 h-16 rounded-lg object-cover"
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = '/placeholder.svg';
                    }}
                  />
                  <div className="flex-1">
                    <h4 className="font-medium">{item.name}</h4>
                    <p className="text-sm text-muted-foreground">{item.description}</p>
                    <p className="text-lg font-semibold">${Number(item.price).toFixed(2)}</p>
                    {item.categories && (
                      <p className="text-xs text-muted-foreground">{item.categories.name}</p>
                    )}
                  </div>
                  <div className="flex flex-col gap-2">
                    <Button size="sm">
                      <Plus className="h-4 w-4 mr-1" />
                      Add to Cart
                    </Button>
                    <Button 
                      size="sm" 
                      variant="outline"
                      onClick={() => handleRemoveFromFavorites(item.id)}
                    >
                      <Heart className="h-4 w-4 mr-1 fill-red-500 text-red-500" />
                      Remove
                    </Button>
                  </div>
                </div>
              </Card>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};