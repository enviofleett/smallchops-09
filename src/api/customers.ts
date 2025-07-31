import { supabase } from '@/integrations/supabase/client';
import type { Customer, CustomerDb, CustomerAnalytics as CustomerAnalyticsType } from '@/types/customers';

export interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  avgOrderValue: number;
  repeatCustomerRate: number;
  guestCustomers: number;
  authenticatedCustomers: number;
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

// Delete a customer (admin only)
export const deleteCustomer = async (customerId: string) => {
  // Check if it's a guest customer (guest IDs start with "guest-")
  if (customerId.startsWith('guest-')) {
    throw new Error('Guest customers cannot be deleted directly. Consider anonymizing their data instead.');
  }
  
  // For registered customers, use the cascade function
  const { data, error } = await supabase
    .rpc('delete_customer_cascade', { p_customer_id: customerId });
  
  if (error) throw new Error(error.message);
  return data;
};

// Updated getCustomerAnalytics to show ALL customers (both registered and guest)
export const getCustomerAnalytics = async (dateRange: DateRange): Promise<CustomerAnalytics> => {
  const { from, to } = dateRange;

  // Fetch registered customers with their auth user emails using JOIN
  const { data: registeredCustomers, error: registeredError } = await supabase
    .from('customer_accounts')
    .select(`
      id,
      user_id,
      name,
      phone,
      created_at,
      users:user_id (
        email
      )
    `)

  if (registeredError) throw new Error(registeredError.message);

  // Fetch ALL orders to get guest customers and order data
  const { data: allOrders, error: ordersError } = await supabase
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
    .neq('status', 'cancelled');

  if (ordersError) throw new Error(ordersError.message);

  // Create customer buckets
  const bucket: Record<string, {
    id: string;
    name: string;
    email: string;
    phone?: string;
    totalOrders: number;
    totalSpent: number;
    lastOrderDate: string;
    status: 'VIP' | 'Active' | 'Inactive' | 'Registered';
    isGuest: boolean;
  }> = {};

  // Add registered customers to bucket
  registeredCustomers?.forEach(customer => {
    const customerKey = `reg:${customer.id}`;
    // Access the joined user data
    const authUser = (customer as any).users;
    
    // Fix name vs email issue - if name looks like email, extract name from email
    let displayName = customer.name;
    if (customer.name && customer.name.includes('@')) {
      // Extract name from email (part before @)
      displayName = customer.name.split('@')[0].replace(/[._]/g, ' ');
      displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    }
    
    bucket[customerKey] = {
      id: customer.id,
      name: displayName || (authUser?.email ? authUser.email.split('@')[0] : 'Unknown User'),
      email: authUser?.email || '',
      phone: customer.phone || '',
      totalOrders: 0,
      totalSpent: 0,
      lastOrderDate: customer.created_at,
      status: 'Registered', // Default status for authenticated users
      isGuest: false,
    };
  });

  // Process orders and add guest customers
  allOrders?.forEach(order => {
    let customerKey = '';
    
    if (order.customer_id) {
      // Registered customer order
      customerKey = `reg:${order.customer_id}`;
    } else {
      // Guest customer order
      customerKey = `guest:${order.customer_name}|${order.customer_email || ''}|${order.customer_phone || ''}`;
      
      // Add guest customer if not already in bucket
      if (!bucket[customerKey]) {
        bucket[customerKey] = {
          id: `guest-${order.customer_name?.toLowerCase().replace(/\s+/g, '-')}-${Date.now()}`,
          name: order.customer_name || 'Unknown',
          email: order.customer_email || '',
          phone: order.customer_phone || '',
          totalOrders: 0,
          totalSpent: 0,
          lastOrderDate: order.order_time,
          status: 'Inactive',
          isGuest: true,
        };
      }
    }

    // Update order data for both registered and guest customers
    if (bucket[customerKey]) {
      bucket[customerKey].totalOrders += 1;
      bucket[customerKey].totalSpent += Number(order.total_amount);
      
      // Update last order date if this order is more recent
      if (new Date(order.order_time) > new Date(bucket[customerKey].lastOrderDate)) {
        bucket[customerKey].lastOrderDate = order.order_time;
      }
    }
  });

  // Compute customer status based on spending and orders
  Object.values(bucket).forEach(c => {
    if (c.totalSpent > 5000) {
      c.status = 'VIP';
    } else if (c.totalOrders > 1) {
      c.status = 'Active';
    } else if (c.totalOrders === 1) {
      c.status = 'Active';
    } else if (!c.isGuest) {
      // Authenticated users with no orders stay as "Registered"
      c.status = 'Registered';
    } else {
      // Guest customers with no orders are "Inactive"
      c.status = 'Inactive';
    }
  });

  const customers: Customer[] = Object.values(bucket);

  // Calculate metrics
  const totalCustomers = customers.length;
  const activeCustomers = customers.filter(c => c.status === 'Active' || c.status === 'VIP').length;
  const guestCustomers = customers.filter(c => c.isGuest).length;
  const authenticatedCustomers = customers.filter(c => !c.isGuest).length;
  const totalRevenue = customers.reduce((sum, c) => sum + c.totalSpent, 0);
  const totalOrders = customers.reduce((sum, c) => sum + c.totalOrders, 0);
  const repeatCustomers = customers.filter(c => c.totalOrders > 1);

  return {
    metrics: {
      totalCustomers,
      activeCustomers,
      avgOrderValue: totalOrders > 0 ? totalRevenue / totalOrders : 0,
      repeatCustomerRate: totalCustomers > 0 ? (repeatCustomers.length / totalCustomers) * 100 : 0,
      guestCustomers,
      authenticatedCustomers
    },
    topCustomersByOrders: customers
      .filter(c => c.totalOrders > 0)
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 10),
    topCustomersBySpending: customers
      .filter(c => c.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10),
    repeatCustomers: repeatCustomers
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 10),
    allCustomers: customers,
    customerTrends: [], // for future use
  };
};
