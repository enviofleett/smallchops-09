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
import { DeliveryZoneDropdown } from '@/components/delivery/DeliveryZoneDropdown';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { ProductRatingsSummary } from '@/components/reviews/ProductRatingsSummary';
import { ReviewCard } from '@/components/reviews/ReviewCard';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { getProductWithDiscounts, getProductsWithDiscounts } from '@/api/productsWithDiscounts';
import { useProductReviews, useProductRatingSummary, useVoteOnReview } from '@/hooks/useProductReviews';
import { PriceDisplay } from '@/components/ui/price-display';
import { StarRating } from '@/components/ui/star-rating';
import { FavoriteButton } from '@/components/ui/favorite-button';
import { DiscountBadge } from '@/components/ui/discount-badge';
import { ProductWithDiscount } from '@/lib/discountCalculations';

// Remove the mock Review interface since we're using the real one from API

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { toast } = useToast();

  const [product, setProduct] = useState<ProductWithDiscount | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<ProductWithDiscount[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedZoneId, setSelectedZoneId] = useState<string>('');
  const [deliveryFee, setDeliveryFee] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);
  const [reviewFilter, setReviewFilter] = useState<{ rating?: number; sortBy: string }>({ sortBy: 'newest' });

  // Fetch reviews and rating summary
  const { data: reviewsData } = useProductReviews(id || '', { 
    page: 1, 
    limit: 10, 
    rating: reviewFilter.rating,
    sortBy: reviewFilter.sortBy as any
  });
  const { data: ratingSummary } = useProductRatingSummary(id || '');
  const voteOnReviewMutation = useVoteOnReview();

  useEffect(() => {
    console.log('ProductDetail component mounted, ID from params:', id);
    if (id) {
      fetchProductDetails();
    } else {
      console.error('No product ID provided in URL');
      setLoading(false);
    }
  }, [id]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      console.log('Fetching product with ID:', id);
      
      // Fetch individual product with discounts
      const productData = await getProductWithDiscounts(id!);
      console.log('Product data received:', productData);
      
      if (productData) {
        setProduct(productData);
        
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

  const handleAddToCart = () => {
    if (!product) return;
    
    addItem(product, quantity);
    toast({
      title: "Added to Cart",
      description: `${quantity} ${product.name} added to cart`,
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
        window.open(`https://wa.me/?text=${text} ${url}`, '_blank');
        break;
      default:
        navigator.clipboard.writeText(url);
        toast({ title: "Link copied to clipboard!" });
    }
  };

  const handleReviewVote = (reviewId: string, voteType: 'helpful' | 'not_helpful') => {
    voteOnReviewMutation.mutate({ reviewId, voteType }, {
      onSuccess: () => {
        toast({ title: "Thank you for your feedback!" });
      },
      onError: () => {
        toast({ title: "Failed to record vote", variant: "destructive" });
      }
    });
  };

  const getPromotionBadge = () => {
    if (!product?.active_promotion) return null;
    
    const promotion = product.active_promotion;
    if (promotion.type === 'percentage') {
      return `${promotion.value}% OFF`;
    } else if (promotion.type === 'fixed_amount') {
      return `₦${promotion.value} OFF`;
    } else if (promotion.type === 'free_delivery') {
      return 'FREE DELIVERY';
    }
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
      <div className="min-h-screen flex items-center justify-center">
        <div className="animate-spin rounded-full h-32 w-32 border-b-2 border-primary"></div>
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
    <div className="min-h-screen bg-background">
      {/* Website Header */}
      <PublicHeader />
      
      {/* Breadcrumb */}
      <div className="bg-muted/30 border-b">
        <div className="container mx-auto px-4 py-3">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <Link to="/" className="hover:text-primary">{product.categories?.name || 'Products'}</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">{product.name}</span>
          </nav>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8">
        {/* Product Main Section */}
        <div className="grid lg:grid-cols-2 gap-12 mb-12">
          {/* Product Image - Reduced by 20% */}
          <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-lg bg-muted w-4/5 mx-auto">
              <img
                src={product.image_url || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=480&h=480&fit=crop'}
                alt={product.name}
                className="w-full h-full object-cover hover:scale-105 transition-transform duration-300"
              />
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
              <div className="flex items-center gap-4 mb-4">
                <StarRating 
                  rating={ratingSummary?.average_rating || 0} 
                  size="md"
                />
                <span className="text-sm text-muted-foreground">
                  ({ratingSummary?.total_reviews || 0} review{ratingSummary?.total_reviews !== 1 ? 's' : ''})
                </span>
              </div>
            </div>

            {/* Promotion Banner */}
            {product.active_promotion && (
              <div className="bg-gradient-to-r from-destructive to-orange-500 text-destructive-foreground px-4 py-3 rounded-lg">
                <div className="flex items-center justify-between">
                  <div>
                    <span className="font-bold text-lg">🔥 {getPromotionBadge()}</span>
                    <p className="text-sm mt-1 opacity-90">Limited time offer - don't miss out!</p>
                  </div>
                  {getPromotionTimeLeft() && (
                    <div className="text-right">
                      <div className="flex items-center gap-1 text-sm">
                        <Timer className="h-4 w-4" />
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
              <p className="text-muted-foreground" dangerouslySetInnerHTML={{ __html: product.description }} />
            </div>

            {/* Features */}
            {product.features && product.features.length > 0 && (
              <div>
                <h3 className="font-semibold mb-2">What's included:</h3>
                <ul className="list-disc list-inside space-y-1 text-sm text-muted-foreground">
                  {product.features.map((feature, index) => (
                    <li key={index}>{feature}</li>
                  ))}
                </ul>
              </div>
            )}

            {/* Quantity and Add to Cart */}
            <div className="space-y-4">
              <div className="flex items-center gap-4">
                <span className="text-sm font-medium">Quantity:</span>
                <div className="flex items-center border rounded-lg">
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    disabled={quantity <= 1}
                  >
                    <Minus className="h-4 w-4" />
                  </Button>
                  <span className="px-4 py-2 min-w-[60px] text-center">{quantity}</span>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => setQuantity(quantity + 1)}
                  >
                    <Plus className="h-4 w-4" />
                  </Button>
                </div>
              </div>

              <div className="flex gap-3">
                <Button 
                  onClick={handleAddToCart}
                  className="flex-1 bg-red-500 hover:bg-red-600 text-white"
                  size="lg"
                >
                  <ShoppingCart className="h-5 w-5 mr-2" />
                  Add to Cart
                </Button>
                <FavoriteButton
                  isFavorite={isFavorite}
                  onToggle={() => setIsFavorite(!isFavorite)}
                  size="lg"
                />
              </div>

              {/* Shipping Zone Selection - Moved under Add to Cart */}
              <div className="border-t pt-4">
                <DeliveryZoneDropdown
                  selectedZoneId={selectedZoneId}
                  onZoneSelect={handleZoneSelect}
                  orderSubtotal={quantity * (product.discounted_price || product.price)}
                />
              </div>
            </div>

            {/* Social Sharing */}
            <div className="space-y-3">
              <h3 className="font-semibold">Share this product:</h3>
              <div className="flex gap-2">
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleShare('telegram')}
                  className="text-blue-500 border-blue-500 hover:bg-blue-50"
                >
                  Telegram
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleShare('twitter')}
                  className="text-blue-400 border-blue-400 hover:bg-blue-50"
                >
                  Twitter
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleShare('whatsapp')}
                  className="text-green-500 border-green-500 hover:bg-green-50"
                >
                  WhatsApp
                </Button>
                <Button 
                  variant="outline" 
                  size="sm"
                  onClick={() => handleShare('other')}
                >
                  <Share className="h-4 w-4 mr-1" />
                  Other
                </Button>
              </div>
            </div>
          </div>
        </div>

        {/* Reviews Section */}
        <div className="space-y-6 mb-8">
          <div className="flex items-center justify-between">
            <h3 className="text-2xl font-bold">Customer Reviews</h3>
          </div>

          {/* Rating Summary */}
          <Card>
            <CardContent className="p-6">
              <ProductRatingsSummary summary={ratingSummary} />
            </CardContent>
          </Card>

          {/* Review Filters */}
          <div className="flex flex-wrap gap-2">
            <Button
              variant={!reviewFilter.rating ? "default" : "outline"}
              size="sm"
              onClick={() => setReviewFilter({ ...reviewFilter, rating: undefined })}
            >
              All Reviews
            </Button>
            {[5, 4, 3, 2, 1].map((rating) => (
              <Button
                key={rating}
                variant={reviewFilter.rating === rating ? "default" : "outline"}
                size="sm"
                onClick={() => setReviewFilter({ ...reviewFilter, rating })}
              >
                {rating} ⭐
              </Button>
            ))}
          </div>

          {/* Reviews List */}
          <div className="space-y-4">
            {reviewsData && reviewsData.reviews.length > 0 ? (
              reviewsData.reviews.map((review) => (
                <ReviewCard
                  key={review.id}
                  review={review}
                  onVoteUpdate={() => {}}
                />
              ))
            ) : (
              <Card>
                <CardContent className="p-8 text-center">
                  <div className="space-y-2">
                    <h4 className="text-lg font-medium">No reviews yet</h4>
                    <p className="text-muted-foreground">Be the first to review this product!</p>
                  </div>
                </CardContent>
              </Card>
            )}
          </div>
        </div>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div>
            <h3 className="text-2xl font-bold mb-6">You might also like</h3>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 md:gap-6">
              {relatedProducts.map((relatedProduct) => (
                <Card key={relatedProduct.id} className="overflow-hidden hover:shadow-lg transition-shadow cursor-pointer">
                  <div 
                    className="aspect-square overflow-hidden"
                    onClick={() => navigate(`/product/${relatedProduct.id}`)}
                  >
                    <img
                      src={relatedProduct.image_url || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=300&h=300&fit=crop'}
                      alt={relatedProduct.name}
                      className="w-full h-full object-cover hover:scale-105 transition-transform"
                    />
                  </div>
                  <CardContent className="p-4">
                    <h4 className="font-semibold mb-2">{relatedProduct.name}</h4>
                    <div className="flex items-center justify-between">
                      <div className="flex flex-col">
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
                            className="mt-1"
                          />
                        )}
                      </div>
                      <Button 
                        size="sm" 
                        onClick={() => addItem(relatedProduct, 1)}
                      >
                        Add to Cart
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default ProductDetail;