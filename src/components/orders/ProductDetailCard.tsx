import { Card, CardContent } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Image, Package, ShoppingCart } from "lucide-react";

interface ProductDetail {
  id: string;
  quantity: number;
  unit_price: number;
  total_price: number;
  product_name: string;
  special_instructions?: string;
  customizations?: any;
  discount_amount?: number;
  vat_amount?: number;
  product?: {
    id: string;
    name: string;
    description: string;
    images?: string[];
    is_available: boolean;
    price: number;
  };
}

interface ProductDetailCardProps {
  item: ProductDetail;
  onReorder?: (productId: string) => void;
  showReorderButton?: boolean;
}

export function ProductDetailCard({ item, onReorder, showReorderButton = false }: ProductDetailCardProps) {
  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0,
    }).format(amount);
  };

  const productImage = item.product?.images?.[0] || '/placeholder.svg';
  const productName = item.product?.name || item.product_name;
  const productDescription = item.product?.description;

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardContent className="p-4">
        <div className="flex gap-4">
          {/* Product Image */}
          <div className="flex-shrink-0">
            <div className="w-16 h-16 bg-muted rounded-lg flex items-center justify-center overflow-hidden">
              {productImage !== '/placeholder.svg' ? (
                <img 
                  src={productImage} 
                  alt={productName}
                  className="w-full h-full object-cover"
                  onError={(e) => {
                    e.currentTarget.src = '/placeholder.svg';
                  }}
                />
              ) : (
                <Image className="w-6 h-6 text-muted-foreground" />
              )}
            </div>
          </div>

          {/* Product Details */}
          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <div className="flex-1">
                <h4 className="font-medium text-sm line-clamp-2">{productName}</h4>
                {productDescription && (
                  <p className="text-xs text-muted-foreground line-clamp-1 mt-1">
                    {productDescription}
                  </p>
                )}
              </div>
              
              {!item.product?.is_available && (
                <Badge variant="secondary" className="text-xs">
                  Unavailable
                </Badge>
              )}
            </div>

            {/* Quantity and Pricing */}
            <div className="flex items-center justify-between mt-2">
              <div className="flex items-center gap-2 text-xs text-muted-foreground">
                <Package className="w-3 h-3" />
                <span>Qty: {item.quantity}</span>
                <span>×</span>
                <span>{formatCurrency(item.unit_price)}</span>
              </div>
              
              <div className="text-sm font-medium">
                {formatCurrency(item.total_price)}
              </div>
            </div>

            {/* Discounts and VAT */}
            {(item.discount_amount || item.vat_amount) && (
              <div className="flex gap-4 text-xs text-muted-foreground mt-1">
                {item.discount_amount && (
                  <span>Discount: -{formatCurrency(item.discount_amount)}</span>
                )}
                {item.vat_amount && (
                  <span>VAT: {formatCurrency(item.vat_amount)}</span>
                )}
              </div>
            )}

            {/* Special Instructions */}
            {item.special_instructions && (
              <div className="mt-2 p-2 bg-muted/50 rounded text-xs">
                <span className="font-medium">Instructions: </span>
                {item.special_instructions}
              </div>
            )}

            {/* Customizations */}
            {item.customizations && typeof item.customizations === 'object' && (
              <div className="mt-2 text-xs">
                <span className="font-medium">Customizations: </span>
                <span className="text-muted-foreground">
                  {Object.entries(item.customizations).map(([key, value]) => (
                    `${key}: ${value}`
                  )).join(', ')}
                </span>
              </div>
            )}

            {/* Reorder Button */}
            {showReorderButton && onReorder && item.product?.id && (
              <Button
                variant="outline"
                size="sm"
                className="mt-3 h-7 text-xs"
                onClick={() => onReorder(item.product!.id)}
                disabled={!item.product.is_available}
              >
                <ShoppingCart className="w-3 h-3 mr-1" />
                Reorder
              </Button>
            )}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}