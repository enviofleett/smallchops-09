import { supabase } from '@/integrations/supabase/client';
import { OrderWithItems } from './orders';
import { OrderStatus } from '@/types/orders';

export interface PurchaseHistoryFilters {
  page?: number;
  pageSize?: number;
  status?: OrderStatus | 'all';
  dateFrom?: string;
  dateTo?: string;
  search?: string;
}

export interface TransactionHistory {
  id: string;
  order_id: string;
  transaction_type: 'charge' | 'refund' | 'partial_refund';
  amount: number;
  currency: string;
  payment_method?: string;
  provider_transaction_id?: string;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  processed_at?: string;
  created_at: string;
  order?: {
    order_number: string;
    customer_name: string;
    total_amount: number;
  };
}

export interface CustomerAnalytics {
  id: string;
  customer_email: string;
  total_orders: number;
  total_spent: number;
  average_order_value: number;
  favorite_category_id?: string;
  last_purchase_date?: string;
  favorite_category?: {
    name: string;
  };
}

export const getCustomerOrderHistory = async (
  customerEmail: string,
  filters: PurchaseHistoryFilters = {}
): Promise<{ orders: OrderWithItems[]; count: number }> => {
  const {
    page = 1,
    pageSize = 10,
    status = 'all',
    dateFrom,
    dateTo,
    search = ''
  } = filters;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('orders')
    .select('*, order_items (*)', { count: 'exact' })
    .eq('customer_email', customerEmail);

  if (status !== 'all') {
    query = query.eq('status', status);
  }

  if (dateFrom) {
    query = query.gte('order_time', dateFrom);
  }

  if (dateTo) {
    query = query.lte('order_time', dateTo);
  }

  if (search) {
    const searchString = `%${search}%`;
    query = query.or(
      `order_number.ilike.${searchString},customer_name.ilike.${searchString}`
    );
  }

  const { data, error, count } = await query
    .order('order_time', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching customer order history:', error);
    throw new Error(error.message);
  }

  return { orders: data || [], count: count || 0 };
};

export const getCustomerTransactionHistory = async (
  customerEmail: string,
  filters: PurchaseHistoryFilters = {}
): Promise<{ transactions: TransactionHistory[]; count: number }> => {
  const {
    page = 1,
    pageSize = 10,
    dateFrom,
    dateTo
  } = filters;

  const from = (page - 1) * pageSize;
  const to = from + pageSize - 1;

  let query = supabase
    .from('payment_transactions')
    .select(`
      *,
      order:orders!inner(
        order_number,
        customer_name,
        customer_email,
        total_amount
      )
    `, { count: 'exact' })
    .eq('order.customer_email', customerEmail);

  if (dateFrom) {
    query = query.gte('created_at', dateFrom);
  }

  if (dateTo) {
    query = query.lte('created_at', dateTo);
  }

  const { data, error, count } = await query
    .order('created_at', { ascending: false })
    .range(from, to);

  if (error) {
    console.error('Error fetching customer transaction history:', error);
    throw new Error(error.message);
  }

  return { transactions: (data as TransactionHistory[]) || [], count: count || 0 };
};

export const getCustomerAnalytics = async (
  customerEmail: string
): Promise<CustomerAnalytics | null> => {
  const { data, error } = await supabase
    .from('customer_purchase_analytics')
    .select(`
      *,
      favorite_category:categories(name)
    `)
    .eq('customer_email', customerEmail)
    .single();

  if (error) {
    if (error.code === 'PGRST116') {
      // No analytics found, return null
      return null;
    }
    console.error('Error fetching customer analytics:', error);
    throw new Error(error.message);
  }

  return data;
};

export const downloadOrderReceipt = async (orderId: string): Promise<Blob> => {
  // This would typically call an edge function to generate a PDF receipt
  // For now, we'll return a simple text receipt
  const { data: order, error } = await supabase
    .from('orders')
    .select('*, order_items (*)')
    .eq('id', orderId)
    .single();

  if (error) {
    throw new Error(error.message);
  }

  const receiptContent = `
RECEIPT
Order Number: ${order.order_number}
Date: ${new Date(order.order_time).toLocaleDateString()}
Customer: ${order.customer_name}

Items:
${order.order_items.map((item: any) => 
  `${item.product_name} x${item.quantity} - $${item.total_price}`
).join('\n')}

Subtotal: $${order.subtotal}
Tax: $${order.tax_amount}
Delivery: $${order.delivery_fee || 0}
Total: $${order.total_amount}

Thank you for your order!
  `;

  return new Blob([receiptContent], { type: 'text/plain' });
};