import React from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Percent, DollarSign, Gift, Truck, AlertCircle, CheckCircle } from 'lucide-react';

interface PromotionHelpPanelProps {
  selectedType: string;
}

const promotionTypeInfo = {
  percentage: {
    icon: Percent,
    title: "Percentage Discount",
    description: "Apply a percentage discount to eligible items",
    example: "20% off all items or specific categories",
    fields: {
      value: "Percentage amount (1-100)",
      minOrder: "Minimum order amount required",
      maxDiscount: "Maximum discount amount (caps the discount)",
      code: "Optional promo code customers enter",
      categories: "Apply to specific categories only",
      products: "Apply to specific products only"
    },
    tips: [
      "Use 10-25% for regular promotions",
      "Higher percentages for clearance sales",
      "Set max discount to control costs",
      "Leave categories/products empty for site-wide discount"
    ],
    validation: [
      "Value must be between 1-100",
      "Max discount should be reasonable",
      "End date must be after start date"
    ]
  },
  fixed_amount: {
    icon: DollarSign,
    title: "Fixed Amount Discount",
    description: "Apply a fixed monetary discount",
    example: "₦500 off orders over ₦5000",
    fields: {
      value: "Fixed discount amount in Naira",
      minOrder: "Minimum order amount required (recommended)",
      code: "Optional promo code customers enter",
      categories: "Apply to specific categories only",
      products: "Apply to specific products only"
    },
    tips: [
      "Always set minimum order amount",
      "Common amounts: ₦100, ₦250, ₦500, ₦1000",
      "Works well for first-time customers",
      "Good for loyalty rewards"
    ],
    validation: [
      "Value should be less than min order amount",
      "Set reasonable usage limits",
      "Consider your profit margins"
    ]
  },
  buy_one_get_one: {
    icon: Gift,
    title: "Buy One Get One (BOGO)",
    description: "Customer gets free items when buying others",
    example: "Buy 2 get 1 free, Buy 1 get 1 at 50% off",
    fields: {
      value: "Discount percentage for free item (0-100)",
      minOrder: "Optional minimum order amount",
      code: "Optional promo code customers enter",
      categories: "Apply to specific categories only",
      products: "Apply to specific products only"
    },
    tips: [
      "Use 100% for completely free items",
      "Use 50% for half-price deals",
      "Target slow-moving inventory",
      "Great for increasing order quantity"
    ],
    validation: [
      "Value 0 = no discount, 100 = completely free",
      "Specify products/categories for best results",
      "Monitor inventory levels"
    ]
  },
  free_delivery: {
    icon: Truck,
    title: "Free Delivery",
    description: "Waive delivery fees for qualifying orders",
    example: "Free delivery on orders over ₦3000",
    fields: {
      minOrder: "Minimum order amount for free delivery",
      code: "Optional promo code customers enter",
      categories: "Apply only to specific categories",
      products: "Apply only to specific products"
    },
    tips: [
      "Set minimum slightly below average order value",
      "Common thresholds: ₦2000, ₦3000, ₦5000",
      "Can be combined with other promotions",
      "Increases conversion rates significantly"
    ],
    validation: [
      "Minimum order should cover delivery costs",
      "Consider your delivery zones",
      "Monitor impact on margins"
    ]
  }
};

export function PromotionHelpPanel({ selectedType }: PromotionHelpPanelProps) {
  const info = promotionTypeInfo[selectedType as keyof typeof promotionTypeInfo];
  
  if (!info) {
    return (
      <Card className="border-orange-200 bg-orange-50">
        <CardContent className="p-4">
          <div className="flex items-center gap-2 text-orange-700">
            <AlertCircle className="w-5 h-5" />
            <span>Select a promotion type to see helpful guidance</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  const Icon = info.icon;

  return (
    <Card className="border-blue-200 bg-blue-50">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center gap-2 text-blue-900">
          <Icon className="w-5 h-5" />
          {info.title}
        </CardTitle>
        <CardDescription className="text-blue-700">
          {info.description}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div>
          <h4 className="font-medium text-blue-900 mb-2">Example:</h4>
          <p className="text-sm text-blue-700 bg-blue-100 p-2 rounded">{info.example}</p>
        </div>

        <div>
          <h4 className="font-medium text-blue-900 mb-2">Field Guide:</h4>
          <div className="space-y-2">
            {Object.entries(info.fields).map(([key, description]) => (
              <div key={key} className="flex items-start gap-2 text-sm">
                <Badge variant="outline" className="text-xs bg-white">{key}</Badge>
                <span className="text-blue-700">{description}</span>
              </div>
            ))}
          </div>
        </div>

        <div>
          <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-1">
            <CheckCircle className="w-4 h-4" />
            Best Practices:
          </h4>
          <ul className="text-sm text-blue-700 space-y-1">
            {info.tips.map((tip, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-blue-500 mt-0.5">•</span>
                {tip}
              </li>
            ))}
          </ul>
        </div>

        <div>
          <h4 className="font-medium text-blue-900 mb-2 flex items-center gap-1">
            <AlertCircle className="w-4 h-4" />
            Validation Notes:
          </h4>
          <ul className="text-sm text-blue-700 space-y-1">
            {info.validation.map((note, index) => (
              <li key={index} className="flex items-start gap-2">
                <span className="text-orange-500 mt-0.5">!</span>
                {note}
              </li>
            ))}
          </ul>
        </div>
      </CardContent>
    </Card>
  );
}