import React, { useState } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { ChevronRight, Search, Settings } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { toImagesArray } from '@/lib/imageUtils';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { getProductsWithDiscounts } from '@/api/productsWithDiscounts';
import { getCategories } from '@/api/categories';
import { PriceDisplay } from '@/components/ui/price-display';
import { DiscountBadge } from '@/components/ui/discount-badge';
import { StarRating } from '@/components/ui/star-rating';
import { useProductRatingSummary } from '@/hooks/useProductReviews';
import { CustomizationProvider, useCustomizationContext } from '@/context/CustomizationContext';
import { CustomizationOrderBuilder } from '@/components/customization/CustomizationOrderBuilder';
import { ShoppingCart } from 'lucide-react';
import { ProductImageGallery } from '@/components/products/ProductImageGallery';
import { ProductMOQIndicator, ProductMOQWarning } from '@/components/products/ProductMOQIndicator';
import { MOQBadge } from '@/components/ui/moq-badge';
import { useEnhancedMOQValidation } from '@/hooks/useEnhancedMOQValidation';
import { MOQAdjustmentModal } from '@/components/cart/MOQAdjustmentModal';

const CategoryProductsContent = () => {
  const { categoryId } = useParams<{ categoryId: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { toast } = useToast();
  const customizationContext = useCustomizationContext();
  const { validateMOQWithPricing, autoAdjustQuantities, showMOQViolationDialog } = useEnhancedMOQValidation();
  
  const [searchTerm, setSearchTerm] = useState('');
  const [currentPage, setCurrentPage] = useState(1);
  const [showCustomizationBuilder, setShowCustomizationBuilder] = useState(false);
  const [showMOQAdjustmentModal, setShowMOQAdjustmentModal] = useState(false);
  const [moqAdjustments, setMoqAdjustments] = useState<any[]>([]);
  const [moqPricingImpact, setMoqPricingImpact] = useState<any>(null);
  const [isValidatingMOQ, setIsValidatingMOQ] = useState(false);
  const itemsPerPage = 12;

  // Fetch products for this category
  const { data: products = [], isLoading: isLoadingProducts } = useQuery({
    queryKey: ['products-with-discounts', categoryId],
    queryFn: () => getProductsWithDiscounts(categoryId),
    enabled: !!categoryId,
  });

  // Fetch categories to get category name
  const { data: categories = [] } = useQuery({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

  const currentCategory = categories.find(cat => cat.id === categoryId);
  const isCustomizationCategory = currentCategory?.name?.toLowerCase().includes('customization') || false;

  // Helper function to get lunch box priority
  const getLunchBoxPriority = (productName: string): number => {
    const name = productName.toLowerCase();
    if (name.includes('monday') && name.includes('lunch')) return 1;
    if (name.includes('tuesday') && name.includes('lunch')) return 2;
    if (name.includes('wednesday') && name.includes('lunch')) return 3;
    if (name.includes('thursday') && name.includes('lunch')) return 4;
    if (name.includes('weekend') && name.includes('lunch')) return 5;
    return 999; // Non-lunch box items go last
  };

  // Helper function to get platter priority
  const getPlatterPriority = (productName: string): number => {
    const name = productName.toLowerCase();
    if (name.includes('budget baller')) return 1;
    if (name.includes('small but mighty')) return 2;
    if (name.includes('chop life box')) return 3;
    if (name.includes('flavour parade')) return 4;
    if (name.includes('weekend vibes')) return 5;
    if (name.includes('premium on a budget')) return 6;
    if (name.includes('flavour fiesta')) return 7;
    if (name.includes('soft life')) return 8;
    if (name.includes('pastry parade')) return 9;
    if (name.includes('vibes on vibes')) return 10;
    if (name.includes('boardroom bites')) return 11;
    if (name.includes('big energy')) return 12;
    if (name.includes('love fiesta')) return 13;
    if (name.includes('owambe box')) return 14;
    if (name.includes('odogwu baller')) return 15;
    return 999; // Non-platter items go last
  };

  // Helper function to get customization group priority
  const getCustomizationGroupPriority = (productName: string): number => {
    const name = productName.toLowerCase();
    
    // Group 1: POFF POFF & PASTRIES
    if (name.includes('poff') || name.includes('mosa') || name.includes('buns')) return 1;
    
    // Group 2: SPRING ROLLS
    if (name.includes('spring roll')) return 2;
    
    // Group 3: SAMOSA
    if (name.includes('samosa')) return 3;
    
    // Group 4: YAM BALLS & SEASONAL
    if (name.includes('yam ball')) return 4;
    
    // Group 5: CORN DOGS & MINI ITEMS
    if (name.includes('corn dog') || (name.includes('meat pie') && name.includes('mini'))) return 5;
    
    // Group 6: SAUSAGE ROLLS & CHICKEN PIE
    if (name.includes('sausage roll') || (name.includes('chicken pie') && name.includes('mini'))) return 6;
    
    // Group 7: SHAWARMA
    if (name.includes('shawarma')) return 7;
    
    // Group 8: BEEF ITEMS
    if (name.includes('beef') || name.includes('stick meat') || name.includes('meatball') || 
        name.includes('asun') || name.includes('kebab')) return 8;
    
    // Group 9: CHICKEN ITEMS
    if (name.includes('chicken') && !name.includes('shawarma') && !name.includes('samosa')) return 9;
    
    // Group 10: TURKEY & GIZZARD
    if (name.includes('turkey') || name.includes('gizdodo') || name.includes('gizzard')) return 10;
    
    // Group 11: FISH & SEAFOOD
    if (name.includes('fish') || name.includes('prawn') || name.includes('tilapia') || 
        name.includes('croaker') || name.includes('catfish') || name.includes('titus')) return 11;
    
    // Group 12: SNAILS & GRILLED SAUSAGE
    if (name.includes('snail') || (name.includes('grilled') && name.includes('sausage'))) return 12;
    
    // Group 13: SIDES & ACCOMPANIMENTS
    if (name.includes('yam') || name.includes('plantain') || name.includes('fries') || 
        name.includes('potato') || name.includes('corn on') || name.includes('pepper sauce')) return 13;
    
    return 999; // Ungrouped items
  };

  // Helper function to get customization group name
  const getCustomizationGroupName = (priority: number): string => {
    const groupNames: { [key: number]: string } = {
      1: 'POFF POFF & PASTRIES',
      2: 'SPRING ROLLS',
      3: 'SAMOSA',
      4: 'YAM BALLS & SEASONAL',
      5: 'CORN DOGS & MINI ITEMS',
      6: 'SAUSAGE ROLLS & PASTRIES',
      7: 'SHAWARMA',
      8: 'BEEF ITEMS',
      9: 'CHICKEN ITEMS',
      10: 'TURKEY & GIZZARD',
      11: 'FISH & SEAFOOD',
      12: 'SNAILS & GRILLED SAUSAGE',
      13: 'SIDES & ACCOMPANIMENTS',
      999: 'OTHER ITEMS'
    };
    return groupNames[priority] || 'OTHER ITEMS';
  };

  // Filter and sort products - Different logic for customization category vs others
  const filteredAndSortedProducts = products
    .filter(product => {
      const searchLower = searchTerm.toLowerCase();
      return (product.name || '').toLowerCase().includes(searchLower) ||
        (product.description || '').toLowerCase().includes(searchLower);
    })
    .sort((a, b) => {
      // Special sorting for customization category - group by food type
      if (isCustomizationCategory) {
        const groupPriorityA = getCustomizationGroupPriority(a.name);
        const groupPriorityB = getCustomizationGroupPriority(b.name);
        
        if (groupPriorityA !== groupPriorityB) {
          return groupPriorityA - groupPriorityB;
        }
        
        // Within same group, sort alphabetically
        return a.name.localeCompare(b.name);
      }
      
      // Original sorting logic for other categories
      // First, sort by lunch box priority
      const lunchPriorityA = getLunchBoxPriority(a.name);
      const lunchPriorityB = getLunchBoxPriority(b.name);
      
      // Then, sort by platter priority
      const platterPriorityA = getPlatterPriority(a.name);
      const platterPriorityB = getPlatterPriority(b.name);
      
      // If both are lunch boxes, sort by lunch box priority
      if (lunchPriorityA < 999 && lunchPriorityB < 999) {
        return lunchPriorityA - lunchPriorityB;
      }
      
      // If both are platters, sort by platter priority
      if (platterPriorityA < 999 && platterPriorityB < 999) {
        return platterPriorityA - platterPriorityB;
      }
      
      // If one is lunch box and other is platter, lunch boxes come first
      if (lunchPriorityA < 999 && platterPriorityB < 999) {
        return -1;
      }
      if (platterPriorityA < 999 && lunchPriorityB < 999) {
        return 1;
      }
      
      // If one is lunch box/platter and other is regular product
      if (lunchPriorityA < 999 || platterPriorityA < 999) {
        return -1;
      }
      if (lunchPriorityB < 999 || platterPriorityB < 999) {
        return 1;
      }
      
      // If both are regular products, sort by price
      const priceA = a.discounted_price || a.price;
      const priceB = b.discounted_price || b.price;
      return priceA - priceB;
    });

  // Group products by customization category (for visual display)
  const groupedProducts = isCustomizationCategory 
    ? filteredAndSortedProducts.reduce((groups: any[], product) => {
        const priority = getCustomizationGroupPriority(product.name);
        const groupName = getCustomizationGroupName(priority);
        
        let group = groups.find(g => g.name === groupName);
        if (!group) {
          group = { name: groupName, priority, products: [] };
          groups.push(group);
        }
        group.products.push(product);
        
        return groups;
      }, []).sort((a, b) => a.priority - b.priority)
    : [];

  // Pagination - applies to filtered products
  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);
  const startIndex = (currentPage - 1) * itemsPerPage;
  const currentProducts = filteredAndSortedProducts.slice(startIndex, startIndex + itemsPerPage);

  const handleAddToCart = async (product: any) => {
    if (isCustomizationCategory) {
      setIsValidatingMOQ(true);
      
      try {
        // Check if product has MOQ requirements
        const moq = product.minimum_order_quantity || 1;
        const currentQuantityInBuilder = customizationContext.items.find(item => item.id === product.id)?.quantity || 0;
        
        if (moq > 1 && currentQuantityInBuilder === 0) {
          // First time adding - check if we need to add the minimum quantity
          const adjustedQuantity = Math.max(1, moq);
          
          // Add with minimum quantity if required
          customizationContext.addItem(product, adjustedQuantity);
          
          if (adjustedQuantity > 1) {
            toast({
              title: "MOQ Applied",
              description: `Added ${adjustedQuantity} ${product.name} to meet minimum order quantity.`,
              variant: "default",
            });
          } else {
            toast({
              title: "Added to customization",
              description: `${product.name} has been added to your custom order.`,
            });
          }
        } else {
          // Normal add (increment by 1)
          customizationContext.addItem(product, 1);
          toast({
            title: "Added to customization",
            description: `${product.name} has been added to your custom order.`,
          });
        }
        
        setShowCustomizationBuilder(true);
      } catch (error) {
        console.error('MOQ validation error:', error);
        toast({
          title: "Error adding item",
          description: "There was an issue adding the item. Please try again.",
          variant: "destructive",
        });
      } finally {
        setIsValidatingMOQ(false);
      }
    } else {
      // For regular categories, add directly to cart (existing logic)
      addItem({
        id: product.id,
        name: product.name,
        price: product.discounted_price || product.price,
        original_price: product.price,
        discount_amount: product.discount_amount,
        vat_rate: product.vat_rate || 7.5,
        image_url: product.image_url,
      });
      
      toast({
        title: "Added to cart",
        description: `${product.name} has been added to your cart.`,
      });
    }
  };

  const ProductRatingDisplay = ({ productId }: { productId: string }) => {
    const { data: ratingSummary } = useProductRatingSummary(productId);
    
    if (!ratingSummary || ratingSummary.total_reviews === 0) {
      return (
        <div className="flex items-center space-x-1">
          <StarRating rating={0} size="sm" />
          <span className="text-xs text-muted-foreground">(0)</span>
        </div>
      );
    }
    
    return (
      <div className="flex items-center space-x-1">
        <StarRating rating={ratingSummary.average_rating} size="sm" />
        <span className="text-xs text-muted-foreground">({ratingSummary.total_reviews})</span>
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <PublicHeader />
      
      {/* Breadcrumb */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground flex items-center">
              {isCustomizationCategory && <Settings className="h-4 w-4 mr-1" />}
              {currentCategory?.name || 'Category'}
            </span>
          </nav>
        </div>
      </div>

      <div className={`container mx-auto px-4 py-6 sm:py-8 transition-all duration-300 ${isCustomizationCategory ? 'lg:pr-80' : ''}`}>
        <div className="grid grid-cols-1 lg:grid-cols-4 gap-6 lg:gap-8">
          {/* Left Sidebar - Categories - Hidden on mobile */}
          <div className="hidden lg:block lg:col-span-1">
            <Card className="bg-white sticky top-4">
              <CardContent className="p-6">
                <h3 className="text-xl font-bold text-red-600 mb-4">Categories</h3>
                <div className="space-y-2">
                  <Button
                    variant="ghost"
                    onClick={() => navigate('/')}
                    className="w-full justify-start px-4 py-2 hover:bg-gray-100 text-gray-700"
                  >
                    All Products
                  </Button>
                  {categories.map((category) => (
                    <Button
                      key={category.id}
                      variant="ghost"
                      onClick={() => navigate(`/category/${category.id}`)}
                      className={`w-full justify-start px-4 py-2 transition-colors ${
                        categoryId === category.id 
                          ? 'bg-red-600 text-white hover:bg-red-700' 
                          : 'hover:bg-gray-100 text-gray-700'
                      }`}
                    >
                      {category.name}
                    </Button>
                  ))}
                </div>
              </CardContent>
            </Card>
            </div>

          {/* Mobile Categories - Horizontal scroll */}
          <div className="lg:hidden col-span-full mb-6">
            <h3 className="text-lg font-bold text-red-600 mb-3 px-2">Categories</h3>
            <div className="flex space-x-3 overflow-x-auto pb-3 px-2">
              <button
                onClick={() => navigate('/')}
                className="flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium bg-white text-gray-700 border border-gray-200"
              >
                All Products
              </button>
              {categories.map((category) => (
                <button
                  key={category.id}
                  onClick={() => navigate(`/category/${category.id}`)}
                  className={`flex-shrink-0 px-4 py-2 rounded-full text-sm font-medium transition-colors ${
                    categoryId === category.id 
                      ? 'bg-red-600 text-white' 
                      : 'bg-white text-gray-700 border border-gray-200'
                  }`}
                >
                  {category.name}
                </button>
              ))}
            </div>
          </div>

          {/* Right Side - Products */}
          <div className="col-span-full lg:col-span-3">
            {/* Header */}
            <div className="mb-6 sm:mb-8">
              <div className="flex items-center justify-between mb-4">
                <h1 className="text-2xl sm:text-3xl font-bold flex items-center">
                  {isCustomizationCategory && <Settings className="h-6 w-6 mr-2 text-primary" />}
                  {currentCategory?.name || 'Products'}
                </h1>
                {isCustomizationCategory && (
                  <div className="lg:hidden flex items-center justify-between bg-primary/5 p-3 rounded-lg">
                    <div className="flex items-center space-x-2">
                      <ShoppingCart className="h-4 w-4 text-primary" />
                      <span className="text-sm font-medium">Custom Order</span>
                      <span className="bg-primary text-primary-foreground text-xs px-2 py-1 rounded-full">
                        {customizationContext.items.length}
                      </span>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setShowCustomizationBuilder(true)}
                    >
                      View Order
                    </Button>
                  </div>
                )}
              </div>
              {currentCategory?.description && (
                <p className="text-muted-foreground mb-4 sm:mb-6">{currentCategory.description}</p>
              )}
              
              {/* Search */}
              <div className="max-w-md mx-auto lg:mx-0">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-muted-foreground w-4 h-4" />
                  <Input
                    placeholder="Search products..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="pl-10 py-3 text-base"
                  />
                </div>
              </div>
            </div>

            {/* Products Grid */}
            {isLoadingProducts ? (
              <div className="grid gap-3 sm:gap-4 lg:gap-6 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
                {Array.from({ length: 6 }).map((_, i) => (
                  <Card key={i} className="animate-pulse">
                    <CardContent className="p-0">
                      <div className="aspect-square bg-muted rounded-t-lg"></div>
                      <div className="p-3 sm:p-4 space-y-2">
                        <div className="h-4 bg-muted rounded"></div>
                        <div className="h-3 bg-muted rounded w-2/3"></div>
                        <div className="h-6 bg-muted rounded w-1/2"></div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
              </div>
            ) : filteredAndSortedProducts.length === 0 ? (
              <div className="text-center py-8 sm:py-12">
                <h3 className="text-lg sm:text-xl font-semibold mb-2">No products found</h3>
                <p className="text-muted-foreground mb-4 px-4">
                  {searchTerm ? 'Try adjusting your search terms.' : 'This category has no products yet.'}
                </p>
                <Button onClick={() => navigate('/')}>
                  Browse All Products
                </Button>
              </div>
            ) : (
              <>
                {isCustomizationCategory ? (
                  // Grouped display for customization category
                  <>
                    {groupedProducts.map((group, groupIndex) => (
                      <div key={group.name} className="col-span-full">
                        {/* Group Header */}
                        <div className="mb-4 mt-8 first:mt-0">
                          <div className="flex items-center">
                            <div className="flex-1 h-px bg-gradient-to-r from-primary/20 via-primary/40 to-primary/20"></div>
                            <h2 className="px-4 text-lg sm:text-xl font-bold text-primary">
                              {group.name}
                            </h2>
                            <div className="flex-1 h-px bg-gradient-to-r from-primary/40 via-primary/20 to-transparent"></div>
                          </div>
                        </div>
                        
                        {/* Products Grid for this group */}
                        <div className="grid gap-3 sm:gap-4 lg:gap-6 mb-6 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
                          {group.products.map((product: any) => (
                            <Card 
                              key={product.id} 
                              className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                              onClick={() => navigate(`/product/${product.id}`)}
                            >
                              <div className="aspect-square relative overflow-hidden">
                                <ProductImageGallery
                                  images={toImagesArray(product)}
                                  alt={product.name}
                                  containerClassName="aspect-square"
                                  sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                                />
                                {(product.discount_percentage || 0) > 0 && (
                                  <div className="absolute top-1 sm:top-2 left-1 sm:left-2 z-10">
                                    <DiscountBadge 
                                      discountPercentage={product.discount_percentage || 0}
                                      size="sm"
                                    />
                                  </div>
                                )}
                                
                                {product.minimum_order_quantity && product.minimum_order_quantity > 1 && (
                                  <div className="absolute top-1 sm:top-2 right-1 sm:right-2 z-10">
                                    <MOQBadge 
                                      minimumQuantity={product.minimum_order_quantity}
                                      variant="default"
                                      showIcon={false}
                                      className="bg-blue-100 text-blue-800 border-blue-200 text-xs"
                                    />
                                  </div>
                                )}
                                
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200 z-5" />
                              </div>
                              <CardContent className="p-2 sm:p-3 lg:p-4">
                                <h3 className="font-semibold mb-1 sm:mb-2 line-clamp-2 text-sm sm:text-base">{product.name}</h3>
                                <div className="mb-1 sm:mb-2">
                                  <ProductRatingDisplay productId={product.id} />
                                </div>
                                
                                <div className="flex items-center justify-between">
                                  <PriceDisplay
                                    originalPrice={product.price}
                                    discountedPrice={product.discounted_price}
                                    hasDiscount={(product.discount_percentage || 0) > 0}
                                    size="sm"
                                  />
                                  <Button 
                                    size="sm" 
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      handleAddToCart(product);
                                    }}
                                    className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
                                    variant="outline"
                                    disabled={isValidatingMOQ}
                                  >
                                    {isValidatingMOQ ? "..." : 
                                      (product.minimum_order_quantity && product.minimum_order_quantity > 1) 
                                        ? `Add ${product.minimum_order_quantity}+`
                                        : "Add"
                                    }
                                  </Button>
                                </div>
                                
                                {product.minimum_order_quantity && product.minimum_order_quantity > 1 && (
                                  <div className="text-center pt-2 mt-2 border-t border-muted">
                                    <span className="text-xs text-muted-foreground">
                                      Min. order: {product.minimum_order_quantity} units
                                    </span>
                                  </div>
                                )}
                              </CardContent>
                            </Card>
                          ))}
                        </div>
                      </div>
                    ))}
                  </>
                ) : (
                  // Standard grid display for other categories
                  <div className="grid gap-3 sm:gap-4 lg:gap-6 mb-8 grid-cols-2 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3">
                  {currentProducts.map((product) => (
                    <Card 
                      key={product.id} 
                      className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer group"
                      onClick={() => navigate(`/product/${product.id}`)}
                    >
                      <div className="aspect-square relative overflow-hidden">
                         <ProductImageGallery
                           images={toImagesArray(product)}
                           alt={product.name}
                           containerClassName="aspect-square"
                           sizes="(max-width: 640px) 50vw, (max-width: 1024px) 33vw, 25vw"
                         />
                         {(product.discount_percentage || 0) > 0 && (
                           <div className="absolute top-1 sm:top-2 left-1 sm:left-2 z-10">
                             <DiscountBadge 
                               discountPercentage={product.discount_percentage || 0}
                               size="sm"
                             />
                           </div>
                         )}
                         
                         {/* MOQ Badge - Only for customization category */}
                         {isCustomizationCategory && product.minimum_order_quantity && product.minimum_order_quantity > 1 && (
                           <div className="absolute top-1 sm:top-2 right-1 sm:right-2 z-10">
                             <MOQBadge 
                               minimumQuantity={product.minimum_order_quantity}
                               variant="default"
                               showIcon={false}
                               className="bg-blue-100 text-blue-800 border-blue-200 text-xs"
                             />
                           </div>
                         )}
                         
                         {/* Hover overlay for better UX */}
                         <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-all duration-200 z-5" />
                       </div>
                       <CardContent className="p-2 sm:p-3 lg:p-4">
                         <h3 className="font-semibold mb-1 sm:mb-2 line-clamp-2 text-sm sm:text-base">{product.name}</h3>
                         <div className="mb-1 sm:mb-2">
                           <ProductRatingDisplay productId={product.id} />
                         </div>
                         
                          {/* MOQ Requirements - Only for non-customization categories */}
                          {!isCustomizationCategory && product.minimum_order_quantity && product.minimum_order_quantity > 1 && (
                            <div className="mb-3">
                              <ProductMOQIndicator
                                minimumOrderQuantity={product.minimum_order_quantity}
                                price={product.discounted_price || product.price}
                                stockQuantity={product.stock_quantity}
                                currentCartQuantity={0}
                                className="text-xs"
                              />
                            </div>
                          )}
                         
                         <div className="flex items-center justify-between">
                           <PriceDisplay
                             originalPrice={product.price}
                             discountedPrice={product.discounted_price}
                             hasDiscount={(product.discount_percentage || 0) > 0}
                             size="sm"
                           />
                            <Button 
                              size="sm" 
                              onClick={(e) => {
                                e.stopPropagation();
                                handleAddToCart(product);
                              }}
                              className="text-xs sm:text-sm px-2 sm:px-3 py-1 sm:py-2"
                              variant={isCustomizationCategory ? "outline" : "default"}
                              disabled={isValidatingMOQ}
                            >
                              {isValidatingMOQ ? "..." : 
                               (isCustomizationCategory && product.minimum_order_quantity && product.minimum_order_quantity > 1) 
                                 ? `Add ${product.minimum_order_quantity}+`
                                 : "Add"
                              }
                            </Button>
                          </div>
                          
                          {/* Min. order text - Only for customization category */}
                          {isCustomizationCategory && product.minimum_order_quantity && product.minimum_order_quantity > 1 && (
                            <div className="text-center pt-2 mt-2 border-t border-muted">
                              <span className="text-xs text-muted-foreground">
                                Min. order: {product.minimum_order_quantity} units
                              </span>
                            </div>
                          )}
                       </CardContent>
                    </Card>
                  ))}
                </div>
                )}


                {/* Pagination */}
                {totalPages > 1 && (
                  <div className="flex justify-center items-center space-x-2">
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
                      disabled={currentPage <= 1}
                    >
                      Previous
                    </Button>
                    
                    {Array.from({ length: totalPages }, (_, i) => (
                      <Button
                        key={i + 1}
                        variant={currentPage === i + 1 ? "default" : "outline"}
                        size="sm"
                        onClick={() => setCurrentPage(i + 1)}
                        className="w-10 h-10"
                      >
                        {i + 1}
                      </Button>
                    ))}
                    
                    <Button
                      variant="outline"
                      onClick={() => setCurrentPage(Math.min(totalPages, currentPage + 1))}
                      disabled={currentPage >= totalPages}
                    >
                      Next
                    </Button>
                  </div>
                )}
              </>
            )}
          </div>
        </div>
      </div>

      {/* Customization Order Builder - Shows when items added or manually opened */}
      {isCustomizationCategory && (
        <CustomizationOrderBuilder
          isOpen={showCustomizationBuilder}
          onClose={() => setShowCustomizationBuilder(false)}
        />
      )}

      {/* MOQ Adjustment Modal */}
      <MOQAdjustmentModal
        isOpen={showMOQAdjustmentModal}
        onClose={() => setShowMOQAdjustmentModal(false)}
        onConfirm={() => {
          // Handle MOQ adjustment confirmation
          toast({
            title: "MOQ Adjustments Applied",
            description: "Your order quantities have been adjusted to meet minimum requirements.",
          });
          setShowMOQAdjustmentModal(false);
        }}
        onCancel={() => {
          setShowMOQAdjustmentModal(false);
        }}
        adjustments={moqAdjustments}
        pricingImpact={moqPricingImpact}
      />

      <PublicFooter />
    </div>
  );
};

const CategoryProducts = () => {
  return (
    <CustomizationProvider>
      <CategoryProductsContent />
    </CustomizationProvider>
  );
};

export default CategoryProducts;