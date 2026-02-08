import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link } from 'react-router-dom';
import { 
  Heart, 
  Share2, 
  Star, 
  Minus, 
  Plus, 
  ShoppingCart, 
  MapPin, 
  Phone, 
  ChevronRight,
  MessageCircle,
  Share,
  ThumbsUp,
  ThumbsDown,
  Timer
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { ResponsiveGrid } from '@/components/layout/ResponsiveGrid';
import { ResponsiveCard } from '@/components/layout/ResponsiveCard';
import { useIsMobile } from '@/hooks/use-mobile';

import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { ProductRatingsSummary } from '@/components/reviews/ProductRatingsSummary';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { getProductWithDiscounts, getProductsWithDiscounts } from '@/api/productsWithDiscounts';
import { useProductRatings } from '@/hooks/useProductRatings';
import { useProductFavorite } from '@/hooks/useProductFavorite';
import { WhatsAppSupportWidget } from '@/components/ui/WhatsAppSupportWidget';
import { PriceDisplay } from '@/components/ui/price-display';
import { StarRating } from '@/components/ui/star-rating';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { DiscountBadge } from '@/components/ui/discount-badge';
import { ProductWithDiscount, formatCurrency } from '@/lib/discountCalculations';
import { sanitizeHtml } from '@/utils/htmlSanitizer';
import { SkeletonLoader } from '@/components/ui/SkeletonLoader';
import { ProductMOQIndicator } from '@/components/products/ProductMOQIndicator';

// Remove the mock Review interface since we're using the real one from API

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem, cart } = useCart();
  const { toast } = useToast();

  const [product, setProduct] = useState<ProductWithDiscount | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductWithDiscount[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [reviewFilter, setReviewFilter] = useState<{ rating?: number; sortBy: string }>({ sortBy: 'newest' });

  const productRatings = useProductRatings(id || '');
  
  // Initialize favorites for this product
  const { isFavorite, isLoading: favoriteLoading, toggleFavorite } = useProductFavorite(id || '');

  useEffect(() => {
    console.log('ProductDetail component mounted, ID from params:', id);
    if (id) {
      fetchProductDetails();
    } else {
      console.error('No product ID provided in URL');
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    // Update page meta tags for social sharing
    if (product) {
      document.title = `${product.name} - Starters`;
      
      // Update Open Graph meta tags
      const updateMetaTag = (property: string, content: string) => {
        let meta = document.querySelector(`meta[property="${property}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('property', property);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      };
      
      const updateTwitterMetaTag = (name: string, content: string) => {
        let meta = document.querySelector(`meta[name="${name}"]`);
        if (!meta) {
          meta = document.createElement('meta');
          meta.setAttribute('name', name);
          document.head.appendChild(meta);
        }
        meta.setAttribute('content', content);
      };
      
      const productImageUrl = product.image_url || '/lovable-uploads/4b7e8feb-69d6-41e6-bf51-31bc57291f4a.png';
      const productDescription = `${product.name} - ${formatCurrency(product.discounted_price || product.price)}`;
      
      updateMetaTag('og:title', product.name);
      updateMetaTag('og:description', productDescription);
      updateMetaTag('og:image', productImageUrl);
      updateMetaTag('og:url', window.location.href);
      updateMetaTag('og:type', 'product');
      
      updateTwitterMetaTag('twitter:title', product.name);
      updateTwitterMetaTag('twitter:description', productDescription);
      updateTwitterMetaTag('twitter:image', productImageUrl);
      updateTwitterMetaTag('twitter:card', 'summary_large_image');
    }
  }, [product]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      console.log('Fetching product with ID:', id);
      
      // Fetch individual product with discounts
      const productData = await getProductWithDiscounts(id!);
      console.log('Product data received:', productData);
      
      if (productData) {
        setProduct(productData);
        
        // Set initial quantity to MOQ if MOQ > 1
        const moq = productData.minimum_order_quantity || 1;
        if (moq > 1) {
          setQuantity(moq);
        }
        
        // Fetch related products from same category - show up to 4 products
        const allProducts = await getProductsWithDiscounts(productData.category_id);
        const related = allProducts
          .filter((p: ProductWithDiscount) => p.id !== id)
          .slice(0, 4);
        setRelatedProducts(related);
        console.log('Related products:', related);
      } else {
        console.log('No product found with ID:', id);
      }

      // Reviews are now handled by the useProductReviews hook
      
    } catch (error) {
      console.error('Error fetching product:', error);
      toast({
        title: "Error",
        description: "Failed to load product details",
        variant: "destructive"
      });
    } finally {
      setLoading(false);
    }
  };

  // Get current cart quantity for this product
  const getCurrentCartQuantity = () => {
    if (!product) return 0;
    const cartItem = cart.items.find(item => item.product_id === product.id);
    return cartItem?.quantity || 0;
  };

  // Get minimum quantity (considering MOQ)
  const getMinimumQuantity = () => {
    if (!product) return 1;
    return product.minimum_order_quantity || 1;
  };

  // Handle manual quantity input with validation
  const handleQuantityChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    
    // Allow empty input for better UX (will be validated onBlur)
    if (value === '') {
      setQuantity(0);
      return;
    }
    
    // Allow only numeric input
    const numericValue = value.replace(/[^0-9]/g, '');
    if (numericValue === '') return;
    
    const parsedValue = parseInt(numericValue, 10);
    
    // Set the value immediately for responsive feel
    // But don't enforce limits yet (onBlur will handle that)
    if (!isNaN(parsedValue) && parsedValue >= 0) {
      setQuantity(parsedValue);
    }
  };

  // Validate and correct quantity on blur
  const handleQuantityBlur = () => {
    if (!product) return;
    
    const minQty = getMinimumQuantity();
    const maxQty = product.stock_quantity;
    
    // Handle empty or invalid input
    if (quantity === 0 || isNaN(quantity)) {
      setQuantity(minQty);
      toast({
        title: "Quantity adjusted",
        description: `Minimum order quantity is ${minQty}`,
        variant: "default"
      });
      return;
    }
    
    // Enforce minimum quantity
    if (quantity < minQty) {
      setQuantity(minQty);
      toast({
        title: "Quantity adjusted",
        description: `Minimum order quantity is ${minQty}`,
        variant: "default"
      });
      return;
    }
    
    // Enforce stock limit
    if (quantity > maxQty) {
      setQuantity(maxQty);
      toast({
        title: "Quantity adjusted",
        description: `Only ${maxQty} units available in stock`,
        variant: "default"
      });
    }
  };

  const handleAddToCart = () => {
    if (!product) return;
    
    const moq = product.minimum_order_quantity || 1;
    const actualQuantity = Math.max(quantity, moq);
    
    addItem({
      id: product.id,
      name: product.name,
      price: product.discounted_price || product.price,
      original_price: product.price,
      discount_amount: product.discount_amount,
      vat_rate: 7.5, // Default VAT rate
      image_url: product.image_url,
      minimum_order_quantity: moq,
      stock_quantity: product.stock_quantity,
    }, actualQuantity);
    
    const addedQuantityText = actualQuantity > quantity ? 
      `${actualQuantity} ${product.name} added to cart (adjusted to meet minimum order quantity)` :
      `${actualQuantity} ${product.name} added to cart`;
    
    toast({
      title: "Added to Cart",
      description: addedQuantityText,
    });
  };

  const handleZoneSelect = (zoneId: string, fee: number) => {
    setSelectedZoneId(zoneId);
    setDeliveryFee(fee);
  };

  const handleShare = (platform: string) => {
    const url = window.location.href;
    const text = `Check out this amazing ${product?.name}!`;
    
    switch (platform) {
      case 'telegram':
        window.open(`https://t.me/share/url?url=${url}&text=${text}`, '_blank');
        break;
      case 'twitter':
        window.open(`https://twitter.com/intent/tweet?url=${url}&text=${text}`, '_blank');
        break;
      case 'whatsapp':
        // WhatsApp will now use the Open Graph meta tags we set to show product image
        window.open(`https://wa.me/?text=${encodeURIComponent(`${text} ${url}`)}`, '_blank');
        break;
      default:
        navigator.clipboard.writeText(url);
        toast({ title: "Link copied to clipboard!" });
    }
  };

  const handleReviewVote = (reviewId: string, voteType: 'helpful' | 'not_helpful') => {
    // Placeholder for review voting functionality
    console.log('Review vote:', reviewId, voteType);
  };

  const getPromotionBadge = () => {
    if (!product?.active_promotion) return null;
    
    const promotion = product.active_promotion;
    if (promotion.type === 'percentage') {
      return `${promotion.value}% OFF`;
    } else if (promotion.type === 'fixed') {
      return `₦${promotion.value} OFF`;
    }
    // Free delivery not currently supported in types
    // else if (promotion.type === 'free_delivery') {
    //   return 'FREE DELIVERY';
    // }
    return 'SPECIAL OFFER';
  };

  const getPromotionTimeLeft = () => {
    if (!product?.active_promotion?.valid_until) return null;
    
    const now = new Date();
    const validUntil = new Date(product.active_promotion.valid_until);
    const timeDiff = validUntil.getTime() - now.getTime();
    
    if (timeDiff <= 0) return null;
    
    const hours = Math.floor(timeDiff / (1000 * 60 * 60));
    const minutes = Math.floor((timeDiff % (1000 * 60 * 60)) / (1000 * 60));
    
    if (hours > 24) {
      const days = Math.floor(hours / 24);
      return `${days} day${days > 1 ? 's' : ''} left`;
    } else if (hours > 0) {
      return `${hours}h ${minutes}m left`;
    } else {
      return `${minutes}m left`;
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white">
        <PublicHeader />
        <div className="container mx-auto px-4 py-6 sm:py-8">
          <SkeletonLoader variant="detail" />
        </div>
        <PublicFooter />
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-screen flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold mb-4">Product not found</h1>
          <Button onClick={() => navigate('/')}>Go back home</Button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      {/* Website Header */}
      <PublicHeader />
      
      {/* Breadcrumb */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <Link to={`/category/${product.categories?.id}`} className="hover:text-primary">{product.categories?.name || 'Products'}</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-4 sm:py-6 lg:py-8">
        {/* Product Main Section */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 lg:gap-12 mb-6 sm:mb-8 lg:mb-12">
          {/* Product Image - Mobile optimized */}
          <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-lg bg-muted w-full max-w-md mx-auto lg:max-w-none">
              <img
                src={product.image_url || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=480&h=480&fit=crop'}
                alt={product.name}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-4 sm:space-y-5 lg:space-y-6">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold mb-2 leading-tight">{product.name}</h1>
              <div className="flex items-center gap-3 sm:gap-4 mb-4 flex-wrap">
                <StarRating 
                  rating={productRatings?.ratingSummary?.average_rating || 0} 
                  size="md"
                />
                <span className="text-xs sm:text-sm text-muted-foreground">
                  ({productRatings?.ratingSummary?.total_reviews || 0} review{productRatings?.ratingSummary?.total_reviews !== 1 ? 's' : ''})
                </span>
              </div>
            </div>

            {/* Promotion Banner */}
            {product.active_promotion && (
              <div className="bg-gradient-to-r from-destructive to-orange-500 text-destructive-foreground px-3 sm:px-4 py-2 sm:py-3 rounded-lg">
                <div className="flex items-center justify-between flex-col sm:flex-row gap-2 sm:gap-0">
                  <div className="text-center sm:text-left">
                    <span className="font-bold text-base sm:text-lg">🔥 {getPromotionBadge()}</span>
                    <p className="text-xs sm:text-sm mt-1 opacity-90">Limited time offer - don't miss out!</p>
                  </div>
                  {getPromotionTimeLeft() && (
                    <div className="text-center sm:text-right">
                      <div className="flex items-center gap-1 text-xs sm:text-sm justify-center sm:justify-end">
                        <Timer className="h-3 w-3 sm:h-4 sm:w-4" />
                        {getPromotionTimeLeft()}
                      </div>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Pricing */}
            <div className="space-y-2">
              <PriceDisplay
                originalPrice={product.price}
                discountedPrice={product.discounted_price}
                hasDiscount={(product.discount_percentage || 0) > 0}
                showSavings={true}
                size="lg"
              />
            </div>

            {/* Description */}
            <div>
              <p className="text-sm sm:text-base text-muted-foreground leading-relaxed" dangerouslySetInnerHTML={{ __html: sanitizeHtml(product.description || '') }} />
            </div>

            {/* Features */}
            {product.features && product.features.length > 0 && (
              <div>
                <h3 className="font-semibold text-sm sm:text-base mb-2">What's included:</h3>
                <ul className="list-disc list-inside space-y-1 text-xs sm:text-sm text-muted-foreground pl-2">
                  {product.features.map((feature, index) => (
                    <li key={index} className="leading-relaxed">{feature}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* MOQ Requirements */}
            {product.minimum_order_quantity && product.minimum_order_quantity > 1 && (
              <ProductMOQIndicator
                minimumOrderQuantity={product.minimum_order_quantity}
                price={product.discounted_price || product.price}
                stockQuantity={product.stock_quantity}
                currentCartQuantity={getCurrentCartQuantity()}
              />
            )}

            {/* Quantity and Add to Cart */}
            <div className="space-y-3 sm:space-y-4">
              <div className="flex items-center gap-2 sm:gap-4 flex-wrap">
                <span className="text-xs sm:text-sm font-medium">Quantity:</span>
                {product.minimum_order_quantity && product.minimum_order_quantity > 1 && (
                  <span className="text-xs text-muted-foreground">
                    (Min: {product.minimum_order_quantity})
                  </span>
                )}
                <div className="flex items-center border rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuantity(Math.max(getMinimumQuantity(), quantity - 1))}
                    disabled={quantity <= getMinimumQuantity()}
                    className="h-8 w-8 p-0"
                  >
                    <Minus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                  <Input
                    type="text"
                    inputMode="numeric"
                    value={quantity === 0 ? '' : quantity}
                    onChange={handleQuantityChange}
                    onBlur={handleQuantityBlur}
                    className="h-8 w-[60px] sm:w-[70px] text-center border-0 focus-visible:ring-0 focus-visible:ring-offset-0 text-sm"
                    placeholder={String(getMinimumQuantity())}
                  />
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => {
                      const maxQty = product?.stock_quantity || 1000;
                      const newQty = Math.min(maxQty, quantity + 1);
                      setQuantity(newQty);
                      if (newQty === maxQty && newQty === quantity) {
                        toast({
                          title: "Stock limit",
                          description: `Only ${maxQty} units available`,
                          variant: "default"
                        });
                      }
                    }}
                    className="h-8 w-8 p-0"
                  >
                    <Plus className="h-3 w-3 sm:h-4 sm:w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex flex-col gap-3">
                <Button 
                  onClick={handleAddToCart}
                  className="w-full bg-primary hover:bg-primary/90 text-primary-foreground"
                  size="lg"
                >
                  <ShoppingCart className="h-4 w-4 sm:h-5 sm:w-5 mr-2" />
                  Add to Cart
                </Button>
                <div className="flex justify-center">
                  <FavoriteButton
                    isFavorite={isFavorite}
                    isLoading={favoriteLoading}
                    onToggle={toggleFavorite}
                    size="lg"
                  />
                </div>
              </div>

              {/* Support Information */}
              <div className="border-t pt-4">
                <WhatsAppSupportWidget />
              </div>
            </div>

            {/* Social Sharing */}
            <div className="space-y-3">
              <h3 className="font-semibold text-sm sm:text-base">Share this product:</h3>
              <div className="grid grid-cols-2 sm:flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleShare('telegram')}
                  className="text-blue-500 border-blue-500 hover:bg-blue-50 text-xs sm:text-sm"
                >
                  Telegram
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleShare('twitter')}
                  className="text-blue-400 border-blue-400 hover:bg-blue-50 text-xs sm:text-sm"
                >
                  Twitter
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleShare('whatsapp')}
                  className="text-green-500 border-green-500 hover:bg-green-50 text-xs sm:text-sm"
                >
                  WhatsApp
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleShare('other')}
                  className="text-xs sm:text-sm"
                >
                  <Share className="h-3 w-3 sm:h-4 sm:w-4 mr-1" />
                  Copy Link
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section Removed */}

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div>
            <h3 className="text-xl sm:text-2xl font-bold mb-4 sm:mb-6">You might also like</h3>
            <ResponsiveGrid columns={2} gap="sm" minItemWidth="200px" autoFit={true}>
              {relatedProducts.map((relatedProduct) => (
                <div 
                  key={relatedProduct.id} 
                  className="cursor-pointer group"
                  onClick={() => navigate(`/product/${relatedProduct.id}`)}
                >
                  <ResponsiveCard 
                    className="overflow-hidden hover:shadow-lg transition-shadow h-full"
                    interactive
                  >
                    <div className="aspect-square overflow-hidden mb-3">
                      <img
                        src={relatedProduct.image_url || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=300&h=300&fit=crop'}
                        alt={relatedProduct.name}
                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                      />
                    </div>
                    <div className="space-y-3">
                      <h4 className="font-semibold text-sm sm:text-base line-clamp-2 leading-snug">{relatedProduct.name}</h4>
                      <div className="flex flex-col gap-2">
                        <PriceDisplay
                          originalPrice={relatedProduct.price}
                          discountedPrice={relatedProduct.discounted_price}
                          hasDiscount={(relatedProduct.discount_percentage || 0) > 0}
                          size="sm"
                        />
                        {(relatedProduct.discount_percentage || 0) > 0 && (
                          <DiscountBadge 
                            discountPercentage={relatedProduct.discount_percentage || 0}
                            size="sm"
                          />
                        )}
                        <Button 
                          size="sm" 
                          className="w-full mt-2"
                          onClick={(e) => {
                            e.stopPropagation();
                            addItem({
                              id: relatedProduct.id,
                              name: relatedProduct.name,
                              price: relatedProduct.discounted_price || relatedProduct.price,
                              original_price: relatedProduct.price,
                              discount_amount: relatedProduct.discount_amount,
                              vat_rate: 7.5,
                              image_url: relatedProduct.image_url,
                              stock_quantity: relatedProduct.stock_quantity,
                            });
                            toast({
                              title: "Added to Cart",
                              description: `${relatedProduct.name} added successfully`,
                            });
                          }}
                        >
                          Add to Cart
                        </Button>
                      </div>
                    </div>
                  </ResponsiveCard>
                </div>
              ))}
            </ResponsiveGrid>
          </div>
        )}
      </div>
      
      {/* Footer */}
      <PublicFooter />
    </div>
  );
};

export default ProductDetail;