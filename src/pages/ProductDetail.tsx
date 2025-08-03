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
  Share
} from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useCart } from '@/hooks/useCart';
import { useToast } from '@/hooks/use-toast';
import { publicAPI } from '@/api/public';
import { PriceDisplay } from '@/components/ui/price-display';
import { StarRating } from '@/components/ui/star-rating';
import { FavoriteButton } from '@/components/ui/favorite-button';

interface Product {
  id: string;
  name: string;
  description: string;
  price: number;
  image_url: string;
  features?: string[];
  categories: {
    id: string;
    name: string;
  };
  discounted_price?: number;
  discount_percentage?: number;
  stock_quantity: number;
  preparation_time?: number;
}

interface Review {
  id: string;
  customer_name: string;
  rating: number;
  comment: string;
  created_at: string;
  verified: boolean;
}

const ProductDetail = () => {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const { addItem } = useCart();
  const { toast } = useToast();

  const [product, setProduct] = useState<Product | null>(null);
  const [relatedProducts, setRelatedProducts] = useState<Product[]>([]);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [quantity, setQuantity] = useState(1);
  const [selectedState, setSelectedState] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [address, setAddress] = useState('');
  const [loading, setLoading] = useState(true);
  const [isFavorite, setIsFavorite] = useState(false);

  useEffect(() => {
    if (id) {
      fetchProductDetails();
    }
  }, [id]);

  const fetchProductDetails = async () => {
    try {
      setLoading(true);
      // Fetch product details
      const productResponse = await fetch(`https://oknnklksdiqaifhxaccs.supabase.co/functions/v1/get-public-products`);
      const allProducts = await productResponse.json();
      const foundProduct = allProducts.find((p: Product) => p.id === id);
      
      if (foundProduct) {
        setProduct(foundProduct);
        
        // Fetch related products from same category
        const related = allProducts
          .filter((p: Product) => p.categories.id === foundProduct.categories.id && p.id !== id)
          .slice(0, 3);
        setRelatedProducts(related);
      }

      // Mock reviews data
      setReviews([
        {
          id: '1',
          customer_name: 'John D.',
          rating: 5,
          comment: 'Amazing taste! Fresh and crispy. Will definitely order again.',
          created_at: '2024-01-15',
          verified: true
        },
        {
          id: '2',
          customer_name: 'Sarah M.',
          rating: 4,
          comment: 'Good quality and fast delivery. Highly recommended.',
          created_at: '2024-01-10',
          verified: true
        }
      ]);
      
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
      {/* Header */}
      <header className="bg-white border-b sticky top-0 z-50">
        <div className="container mx-auto px-4 py-4">
          <nav className="flex items-center space-x-2 text-sm text-muted-foreground">
            <Link to="/" className="hover:text-primary">Home</Link>
            <ChevronRight className="h-4 w-4" />
            <Link to="/" className="hover:text-primary">{product.categories.name}</Link>
            <ChevronRight className="h-4 w-4" />
            <span className="text-foreground">{product.name}</span>
          </nav>
        </div>
      </header>

      <div className="container mx-auto px-4 py-8">
        {/* Product Main Section */}
        <div className="grid lg:grid-cols-2 gap-12 mb-12">
          {/* Product Image */}
          <div className="space-y-4">
            <div className="aspect-square overflow-hidden rounded-lg bg-gray-100">
              <img
                src={product.image_url || 'https://images.unsplash.com/photo-1618160702438-9b02ab6515c9?w=600&h=600&fit=crop'}
                alt={product.name}
                className="w-full h-full object-cover hover:scale-105 transition-transform"
              />
            </div>
          </div>

          {/* Product Details */}
          <div className="space-y-6">
            <div>
              <h1 className="text-3xl font-bold mb-2">{product.name}</h1>
              <div className="flex items-center gap-4 mb-4">
                <StarRating rating={4.5} />
                <span className="text-sm text-muted-foreground">(24 reviews)</span>
              </div>
            </div>

            {/* Hot Deals Banner */}
            {product.discount_percentage && (
              <div className="bg-gradient-to-r from-red-500 to-orange-500 text-white px-4 py-2 rounded-lg inline-block">
                <span className="font-bold">🔥 Hot Deals - {product.discount_percentage}% OFF</span>
              </div>
            )}

            {/* Pricing */}
            <div className="space-y-2">
              <PriceDisplay
                originalPrice={product.price}
                discountedPrice={product.discounted_price}
                hasDiscount={!!product.discount_percentage}
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

        {/* Location Selection */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4 flex items-center">
              <MapPin className="h-5 w-5 mr-2 text-red-500" />
              Select Delivery Location
            </h3>
            <div className="grid md:grid-cols-3 gap-4">
              <Select value={selectedState} onValueChange={setSelectedState}>
                <SelectTrigger>
                  <SelectValue placeholder="Select State" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="lagos">Lagos</SelectItem>
                  <SelectItem value="abuja">Abuja</SelectItem>
                  <SelectItem value="ogun">Ogun</SelectItem>
                </SelectContent>
              </Select>
              
              <Select value={selectedCity} onValueChange={setSelectedCity}>
                <SelectTrigger>
                  <SelectValue placeholder="Select City" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ikeja">Ikeja</SelectItem>
                  <SelectItem value="lekki">Lekki</SelectItem>
                  <SelectItem value="victoria-island">Victoria Island</SelectItem>
                </SelectContent>
              </Select>
              
              <Input 
                placeholder="Enter full address"
                value={address}
                onChange={(e) => setAddress(e.target.value)}
              />
            </div>
          </CardContent>
        </Card>

        {/* Contact Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Phone className="h-5 w-5 text-red-500" />
                <div>
                  <h3 className="font-semibold">Need Help?</h3>
                  <p className="text-sm text-muted-foreground">Call us for quick orders</p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-bold text-lg">+234 808 123 4567</p>
                <Button variant="outline" size="sm" className="mt-1">
                  <MessageCircle className="h-4 w-4 mr-1" />
                  Chat Now
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Reviews Section */}
        <Card className="mb-8">
          <CardContent className="p-6">
            <h3 className="text-lg font-semibold mb-4">Customer Reviews</h3>
            <div className="space-y-4">
              {reviews.map((review) => (
                <div key={review.id} className="border-b pb-4 last:border-b-0">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{review.customer_name}</span>
                      {review.verified && (
                        <Badge variant="secondary" className="text-xs">Verified</Badge>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      <StarRating rating={review.rating} size="sm" />
                      <span className="text-sm text-muted-foreground">{review.created_at}</span>
                    </div>
                  </div>
                  <p className="text-muted-foreground">{review.comment}</p>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Related Products */}
        {relatedProducts.length > 0 && (
          <div>
            <h3 className="text-2xl font-bold mb-6">You might also like</h3>
            <div className="grid md:grid-cols-3 gap-6">
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
                      <PriceDisplay
                        originalPrice={relatedProduct.price}
                        discountedPrice={relatedProduct.discounted_price}
                        hasDiscount={!!relatedProduct.discount_percentage}
                        size="sm"
                      />
                      <Button 
                        size="sm" 
                        className="bg-red-500 hover:bg-red-600 text-white"
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