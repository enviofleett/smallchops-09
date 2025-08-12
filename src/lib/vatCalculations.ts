// VAT calculation utilities for production-ready implementation

export interface VATBreakdown {
  cost_price: number;
  vat_amount: number;
  total_price: number;
  vat_rate: number;
}

export interface CartVATSummary {
  subtotal_cost: number;
  total_vat: number;
  delivery_fee: number;
  grand_total: number;
  items_breakdown: Array<{
    product_id: string;
    product_name: string;
    quantity: number;
    unit_cost: number;
    unit_vat: number;
    unit_price: number;
    total_cost: number;
    total_vat: number;
    total_price: number;
    vat_rate: number;
  }>;
}

export function calculateVATBreakdown(
  price: number, 
  vatRate: number = 7.5
): VATBreakdown {
  const total_price = price;
  const cost_price = Math.round((price / (1 + (vatRate / 100))) * 100) / 100;
  const vat_amount = Math.round((total_price - cost_price) * 100) / 100;
  
  return {
    cost_price,
    vat_amount,
    total_price,
    vat_rate: vatRate
  };
}

export function calculateCartVATSummary(
  cartItems: Array<{
    product_id: string;
    product_name: string;
    price: number;
    quantity: number;
    vat_rate?: number;
  }>,
  deliveryFee: number = 0
): CartVATSummary {
  let subtotal_cost = 0;
  let total_vat = 0;
  let subtotal_price = 0;
  
  const items_breakdown = cartItems.map(item => {
    const vatRate = item.vat_rate || 7.5;
    const itemBreakdown = calculateVATBreakdown(item.price, vatRate);
    
    const total_cost = Math.round(itemBreakdown.cost_price * item.quantity * 100) / 100;
    const total_vat_item = Math.round(itemBreakdown.vat_amount * item.quantity * 100) / 100;
    const total_price = Math.round(item.price * item.quantity * 100) / 100;
    
    subtotal_cost += total_cost;
    total_vat += total_vat_item;
    subtotal_price += total_price;
    
    return {
      product_id: item.product_id,
      product_name: item.product_name,
      quantity: item.quantity,
      unit_cost: itemBreakdown.cost_price,
      unit_vat: itemBreakdown.vat_amount,
      unit_price: item.price,
      total_cost,
      total_vat: total_vat_item,
      total_price,
      vat_rate: vatRate
    };
  });
  
  return {
    subtotal_cost: Math.round(subtotal_cost * 100) / 100,
    total_vat: Math.round(total_vat * 100) / 100,
    delivery_fee: deliveryFee,
    grand_total: Math.round((subtotal_price + deliveryFee) * 100) / 100,
    items_breakdown
  };
}

export function formatCurrency(amount: number): string {
  // Convert from kobo to Naira for display (divide by 100)
  return `₦${(amount / 100).toFixed(2)}`;
}

export function validateVATCalculation(
  costPrice: number, 
  vatAmount: number, 
  totalPrice: number, 
  tolerance: number = 0.01
): boolean {
  const calculatedTotal = costPrice + vatAmount;
  return Math.abs(calculatedTotal - totalPrice) <= tolerance;
}