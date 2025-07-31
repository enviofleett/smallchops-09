import { supabase } from '@/integrations/supabase/client';
import type { Customer, CustomerDb, CustomerAnalytics as CustomerAnalyticsType } from '@/types/customers';

export interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  avgOrderValue: number;
  repeatCustomerRate: number;
}

// Update CustomerAnalytics to use Customer[] everywhere
export interface CustomerAnalytics {
  metrics: CustomerMetrics;
  topCustomersByOrders: Customer[];
  topCustomersBySpending: Customer[];
  repeatCustomers: Customer[];
  customerTrends: {
    date: string;
    newCustomers: number;
    returningCustomers: number;
  }[];
  allCustomers?: Customer[];
}

export interface DateRange {
  from: Date;
  to: Date;
}

/**
 * Fetch all delivery details (orders) for a specific customer, including products/line items.
 * Match by exact customer_name & customer_phone for precision.
 */
export const getCustomerDeliveryHistory = async (
  customerName: string,
  customerPhone?: string
): Promise<
  Array<{
    id: string;
    order_number: string;
    order_time: string;
    delivery_address: string;
    order_type: string;
    status: string;
    total_amount: number;
    order_items: {
      id: string;
      quantity: number;
      unit_price: number;
      product: {
        name: string;
      } | null;
    }[];
  }>
> => {
  let query = supabase
    .from('orders')
    .select(`
      id,
      order_number,
      order_time,
      delivery_address,
      order_type,
      status,
      total_amount,
      order_items(
        id,
        quantity,
        unit_price,
        product:products(name)
      )
    `)
    .eq('customer_name', customerName);

  if (customerPhone) {
    query = query.eq('customer_phone', customerPhone);
  }

  query = query.order('order_time', { ascending: false });

  const { data, error } = await query;
  if (error) {
    throw new Error(error.message);
  }
  return data ?? [];
};

// New helper for resolving or creating a customer by email (use on checkout/registration)
export const resolveOrCreateCustomer = async ({
  email,
  name,
  phone,
}: { email: string; name: string; phone?: string }): Promise<CustomerDb> => {
  // Try fetch by email first
  const { data: found, error: fetchError } = await supabase
    .from('customers')
    .select('*')
    .eq('email', email)
    .single();

  if (found) return found as CustomerDb;

  // If not found, create new
  const { data: created, error: createError } = await supabase
    .from('customers')
    .insert([{ email, name, phone }])
    .select('*')
    .single();

  if (createError) throw new Error(createError.message);
  return created as CustomerDb;
};

// Usage: when creating an order on frontend, pass customer_id if session user exists

// Create a new customer
export const createCustomer = async (data: { name: string; email: string; phone?: string }) => {
  const { data: created, error } = await supabase
    .from('customers')
    .insert([{ name: data.name, email: data.email, phone: data.phone }])
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return created as CustomerDb;
};

// Update an existing customer
export const updateCustomer = async (id: string, data: { name?: string; email?: string; phone?: string }) => {
  const { data: updated, error } = await supabase
    .from('customers')
    .update(data)
    .eq('id', id)
    .select('*')
    .single();
  if (error) throw new Error(error.message);
  return updated as CustomerDb;
};

// Updated getCustomerAnalytics to show ALL customers (including those without orders)
export const getCustomerAnalytics = async (dateRange: DateRange): Promise<CustomerAnalytics> => {
  const { from, to } = dateRange;

  // Fetch ALL customers using the new function (includes customers without orders)
  const { data: allCustomersData, error: customersError } = await supabase
    .rpc('get_all_customers_for_analytics');
  
  if (customersError) throw new Error(customersError.message);

  // Fetch orders within date range
  const { data: ordersData, error: ordersError } = await supabase
    .from('orders')
    .select(`
      id,
      customer_id,
      customer_name,
      customer_phone,
      customer_email,
      total_amount,
      order_time,
      status
    `)
    .gte('order_time', from.toISOString())
    .lte('order_time', to.toISOString())
    .neq('status', 'cancelled');

  if (ordersError) throw new Error(ordersError.message);

  // Create customer buckets with ALL customers (including those without orders)
  const bucket: Record<string, {
    id: string;
    name: string;
    email: string;
    phone?: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: string;
    status: 'VIP' | 'Active' | 'Inactive';
    isGuest: boolean;
  }> = {};

  // First, add ALL customers to the bucket (ensures customers without orders are included)
  allCustomersData?.forEach(customer => {
    const customerKey = customer.is_registered ? `reg:${customer.customer_id}` : `guest:${customer.customer_name}|${customer.customer_email || ''}|${customer.customer_phone || ''}`;
    
    bucket[customerKey] = {
      id: customer.customer_id,
      name: customer.customer_name,
      email: customer.customer_email || '',
      phone: customer.customer_phone || '',
      totalOrders: 0,
      totalSpent: 0,
      lastOrderDate: customer.registration_date,
      status: 'Inactive',
      isGuest: !customer.is_registered,
    };
  });

  // Then, add order data to existing customers
  ordersData?.forEach(order => {
    let customerKey = '';
    
    if (order.customer_id) {
      customerKey = `reg:${order.customer_id}`;
    } else {
      customerKey = `guest:${order.customer_name}|${order.customer_email || ''}|${order.customer_phone || ''}`;
    }

    // If customer exists in bucket, update their order data
    if (bucket[customerKey]) {
      bucket[customerKey].totalOrders += 1;
      bucket[customerKey].totalSpent += Number(order.total_amount);
      
      // Update last order date if this order is more recent
      if (order.order_time > bucket[customerKey].lastOrderDate) {
        bucket[customerKey].lastOrderDate = order.order_time;
      }
    } else {
      // If not in bucket (edge case), create entry
      bucket[customerKey] = {
        id: order.customer_id || `guest:${order.customer_name}|${order.customer_email || ''}|${order.customer_phone || ''}`,
        name: order.customer_name,
        email: order.customer_email || '',
        phone: order.customer_phone || '',
        totalOrders: 1,
        totalSpent: Number(order.total_amount),
        lastOrderDate: order.order_time,
        status: 'Inactive',
        isGuest: !order.customer_id,
      };
    }
  });

  // Compute customer status based on spending and orders
  Object.values(bucket).forEach(c => {
    if (c.totalSpent > 5000) c.status = 'VIP';
    else if (c.totalOrders > 1) c.status = 'Active';
    else c.status = 'Inactive';
  });

  const customers: Customer[] = Object.values(bucket);

  // Calculate metrics
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'Active' || c.status === 'VIP').length;
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0);
  const repeatCustomers = customers.filter(c => c.totalOrders > 1);

  return {
    metrics: {
      totalCustomers,
      activeCustomers,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      repeatCustomerRate: totalCustomers > 0 ? (repeatCustomers.length / totalCustomers) * 100 : 0
    },
    topCustomersByOrders: customers
      .filter(c => !c.isGuest && c.totalOrders > 0)
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 10),
    topCustomersBySpending: customers
      .filter(c => !c.isGuest && c.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10),
    repeatCustomers: repeatCustomers
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 10),
    allCustomers: customers,
    customerTrends: [], // for future use
  };
};
