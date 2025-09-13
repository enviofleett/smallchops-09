import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Search, Filter, Tag } from 'lucide-react';
import { DiscountedProductCard } from './DiscountedProductCard';
import { getProductsWithDiscounts } from '@/api/productsWithDiscounts';
import { getCategories } from '@/api/categories';
import { ProductWithDiscount } from '@/lib/discountCalculations';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';

import { useEnhancedMOQValidation } from '@/hooks/useEnhancedMOQValidation';
import { MOQAdjustmentModal } from '@/components/cart/MOQAdjustmentModal';

interface ProductCatalogProps {
  onToggleFavorite?: (productId: string) => void;
  favoriteProducts?: string[];
}

export function ProductCatalog({ onToggleFavorite, favoriteProducts = [] }: ProductCatalogProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState<string>('all');
  const [sortBy, setSortBy] = useState<string>('name');
  const [showMOQModal, setShowMOQModal] = useState(false);
  const [moqAdjustments, setMoqAdjustments] = useState<any>(null);
  
  const { addItem } = useCart();
  const { toast } = useToast();
  const { validateMOQWithPricing, autoAdjustQuantities } = useEnhancedMOQValidation();
  
  // Fetch products with discounts - Production Ready
  const { 
    data: products = [], 
    isLoading: isLoadingProducts, 
    error: productsError,
    refetch: refetchProducts 
  } = useQuery({
    queryKey: ['products-with-discounts', selectedCategory === 'all' ? undefined : selectedCategory],
    queryFn: () => getProductsWithDiscounts(selectedCategory === 'all' ? undefined : selectedCategory),
    retry: 2,
    retryDelay: (attemptIndex) => Math.min(1000 * 2 ** attemptIndex, 5000),
  });
  
  // Fetch categories
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });
  
  // Filter and sort products
  const filteredProducts = products
    .filter(product => 
      product.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      (product.description && product.description.toLowerCase().includes(searchTerm.toLowerCase()))
    )
    .sort((a, b) => {
      // For "All" category, prioritize price sorting (most affordable first) unless user explicitly chooses different sort
      if (selectedCategory === 'all' && sortBy === 'name') {
        return a.price - b.price; // Sort by price low to high for "All" category
      }
      
      switch (sortBy) {
        case 'name':
          return a.name.localeCompare(b.name);
        case 'price-low':
          return a.price - b.price;
        case 'price-high':
          return b.price - a.price;
        case 'discount':
          return b.discount_percentage - a.discount_percentage;
        default:
          return 0;
      }
    });
  
  const handleAddToCart = async (product: ProductWithDiscount) => {
    // Add product with MOQ information
    addItem({
      id: product.id,
      name: product.name,
      price: product.discounted_price || product.price,
      original_price: product.price,
      discount_amount: product.discount_amount,
      vat_rate: 7.5, // Default VAT rate
      image_url: product.image_url,
      minimum_order_quantity: product.minimum_order_quantity || 1,
    });
    
    toast({
      title: "Added to cart",
      description: `${product.name} has been added to your cart.`,
    });
  };
  
  const discountedProducts = filteredProducts.filter(p => p.has_discount);
  const regularProducts = filteredProducts.filter(p => !p.has_discount);
  
  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row gap-4 items-start sm:items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold">Our Menu</h2>
          <p className="text-muted-foreground">
            {discountedProducts.length > 0 && (
              <span className="text-green-600 font-medium">
                {discountedProducts.length} items on sale!
              </span>
            )}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Badge variant="outline" className="text-green-600 border-green-600">
            <Tag className="w-3 h-3 mr-1" />
            Special Offers
          </Badge>
        </div>
      </div>
      
      {/* Filters */}
      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col sm:flex-row gap-4">
            {/* Search */}
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
              <Input
                placeholder="Search products..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-10"
              />
            </div>
            
            {/* Category Filter */}
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="All Categories" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">All Categories</SelectItem>
                {categories.map((category) => (
                  <SelectItem key={category.id} value={category.id}>
                    {category.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            {/* Sort By */}
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-full sm:w-48">
                <SelectValue placeholder="Sort by" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Name A-Z</SelectItem>
                <SelectItem value="price-low">Price: Low to High</SelectItem>
                <SelectItem value="price-high">Price: High to Low</SelectItem>
                <SelectItem value="discount">Best Discounts</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>
      
      {/* Loading State */}
      {isLoadingProducts && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {[...Array(8)].map((_, i) => (
            <Card key={i} className="h-80 animate-pulse">
              <CardContent className="p-0">
                <div className="aspect-square bg-muted" />
                <div className="p-4 space-y-2">
                  <div className="h-4 bg-muted rounded" />
                  <div className="h-3 bg-muted rounded w-2/3" />
                  <div className="h-6 bg-muted rounded w-1/2" />
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}
      
      {/* Special Offers Section */}
      {!isLoadingProducts && discountedProducts.length > 0 && (
        <div>
          <Card className="border-green-200 bg-green-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-green-800 flex items-center gap-2">
                <Tag className="w-5 h-5" />
                Special Offers & Discounts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {discountedProducts.map((product) => (
                  <DiscountedProductCard
                    key={product.id}
                    product={product}
                    onAddToCart={handleAddToCart}
                    onToggleFavorite={onToggleFavorite}
                    isFavorite={favoriteProducts.includes(product.id)}
                  />
                ))}
              </div>
            </CardContent>
          </Card>
        </div>
      )}
      
      {/* Regular Products Section */}
      {!isLoadingProducts && regularProducts.length > 0 && (
        <div>
          {discountedProducts.length > 0 && (
            <h3 className="text-xl font-semibold mb-4">All Products</h3>
          )}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {regularProducts.map((product) => (
              <DiscountedProductCard
                key={product.id}
                product={product}
                onAddToCart={handleAddToCart}
                onToggleFavorite={onToggleFavorite}
                isFavorite={favoriteProducts.includes(product.id)}
              />
            ))}
          </div>
        </div>
      )}
      
      {/* Error State */}
      {!isLoadingProducts && productsError && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              <Filter className="w-12 h-12 mx-auto mb-4 opacity-50 text-red-500" />
              <h3 className="text-lg font-medium mb-2 text-red-600">Unable to load products</h3>
              <p className="mb-4">There was an issue loading our products. Please try again.</p>
              <Button onClick={() => refetchProducts()} variant="outline">
                Retry
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {/* No Results */}
      {!isLoadingProducts && !productsError && filteredProducts.length === 0 && (
        <Card>
          <CardContent className="p-8 text-center">
            <div className="text-muted-foreground">
              <Filter className="w-12 h-12 mx-auto mb-4 opacity-50" />
              <h3 className="text-lg font-medium mb-2">No products found</h3>
              <p>Try adjusting your search or filter criteria.</p>
            </div>
          </CardContent>
        </Card>
      )}
      
      
      {/* MOQ Adjustment Modal */}
      <MOQAdjustmentModal
        isOpen={showMOQModal}
        onClose={() => setShowMOQModal(false)}
        onConfirm={async () => {
          setShowMOQModal(false);
          toast({
            title: "Cart Updated",
            description: "Quantities have been adjusted to meet minimum order requirements.",
          });
        }}
        onCancel={() => setShowMOQModal(false)}
        adjustments={moqAdjustments?.adjustmentsMade || []}
        pricingImpact={moqAdjustments?.pricingImpact}
      />
    </div>
  );
}