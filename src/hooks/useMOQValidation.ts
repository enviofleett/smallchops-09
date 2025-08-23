import { useToast } from '@/hooks/use-toast';

export interface MOQValidationResult {
  isValid: boolean;
  violations: {
    productId: string;
    productName: string;
    currentQuantity: number;
    minimumRequired: number;
    shortfall: number;
  }[];
}

export const useMOQValidation = () => {
  const { toast } = useToast();

  const validateMOQ = (cartItems: any[], products: any[]): MOQValidationResult => {
    const violations: MOQValidationResult['violations'] = [];

    cartItems.forEach(cartItem => {
      const product = products.find(p => p.id === cartItem.id);
      if (!product) return;

      const moq = product.minimum_order_quantity || 1;
      const currentQuantity = cartItem.quantity || 0;

      if (currentQuantity < moq) {
        violations.push({
          productId: product.id,
          productName: product.name,
          currentQuantity,
          minimumRequired: moq,
          shortfall: moq - currentQuantity
        });
      }
    });

    return {
      isValid: violations.length === 0,
      violations
    };
  };

  const showMOQViolationToast = (violations: MOQValidationResult['violations']) => {
    if (violations.length === 1) {
      const violation = violations[0];
      toast({
        title: "Minimum Order Quantity Not Met",
        description: `${violation.productName} requires a minimum order of ${violation.minimumRequired} items. You currently have ${violation.currentQuantity}.`,
        variant: "destructive",
      });
    } else {
      toast({
        title: "Multiple MOQ Requirements Not Met",
        description: `${violations.length} products don't meet their minimum order quantities. Please check your cart.`,
        variant: "destructive",
      });
    }
  };

  const validateAndNotify = (cartItems: any[], products: any[]): boolean => {
    const result = validateMOQ(cartItems, products);
    
    if (!result.isValid) {
      showMOQViolationToast(result.violations);
      return false;
    }
    
    return true;
  };

  return {
    validateMOQ,
    showMOQViolationToast,
    validateAndNotify
  };
};