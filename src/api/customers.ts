import { supabase } from '@/integrations/supabase/client';
import type { Customer, CustomerDb, CustomerAnalytics as CustomerAnalyticsType } from '@/types/customers';
import { getCustomerEmailStatuses } from './emailStatus';

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

// Response types for database functions
interface DatabaseOperationResult {
  success: boolean;
  errors?: string[];
  message?: string;
  customer_id?: string;
  welcome_email_queued?: boolean;
  changes?: Record<string, any>;
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
    .maybeSingle();

  if (found) return found as CustomerDb;

  // If not found, create new
  const { data: created, error: createError } = await supabase
    .from('customers')
    .insert([{ email, name, phone }])
    .select('*')
    .maybeSingle();

  if (createError) throw new Error(createError.message);
  return created as CustomerDb;
};

// Usage: when creating an order on frontend, pass customer_id if session user exists

// Enhanced customer creation with production validations and email integration
export const createCustomer = async (
  data: { name: string; email: string; phone?: string },
  sendWelcomeEmail: boolean = true
) => {
  try {
    // Get user agent and IP for audit logging (if available)
    const userAgent = navigator?.userAgent || 'Unknown';
    
    // Call the enhanced database function with validations
    const { data: result, error } = await supabase.rpc('create_customer_with_validation', {
      p_name: data.name,
      p_email: data.email,
      p_phone: data.phone || null,
      p_admin_id: (await supabase.auth.getUser()).data.user?.id || null,
      p_send_welcome_email: sendWelcomeEmail,
      p_user_agent: userAgent
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const resultData = result as unknown as DatabaseOperationResult;
    if (!resultData.success) {
      const errorMessage = Array.isArray(resultData.errors) 
        ? resultData.errors.join(', ') 
        : resultData.message || 'Failed to create customer';
      throw new Error(errorMessage);
    }

    // Fetch the created customer data
    const { data: customerData, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', resultData.customer_id)
      .maybeSingle();

    if (fetchError || !customerData) {
      throw new Error('Customer created but failed to retrieve data');
    }

    return {
      ...customerData,
      welcomeEmailQueued: resultData.welcome_email_queued
    } as CustomerDb & { welcomeEmailQueued: boolean };

  } catch (error: any) {
    // Enhanced error handling with specific error types
    if (error.message.includes('already exists')) {
      throw new Error('A customer with this email already exists. Please use a different email address.');
    } else if (error.message.includes('Invalid email')) {
      throw new Error('Please enter a valid email address.');
    } else if (error.message.includes('Phone number')) {
      throw new Error('Please enter a valid phone number with at least 10 digits.');
    } else if (error.message.includes('required')) {
      throw new Error('Please fill in all required fields.');
    } else if (error.message.includes('rate limit')) {
      throw new Error('You are creating customers too quickly. Please wait a moment and try again.');
    } else {
      console.error('Customer creation error:', error);
      throw new Error(error.message || 'Failed to create customer. Please try again.');
    }
  }
};

// Enhanced customer update with production validations
export const updateCustomer = async (
  id: string, 
  data: { name?: string; email?: string; phone?: string }
) => {
  try {
    // Get user agent for audit logging (if available)
    const userAgent = navigator?.userAgent || 'Unknown';
    
    // Call the enhanced database function with validations
    const { data: result, error } = await supabase.rpc('update_customer_with_validation', {
      p_customer_id: id,
      p_name: data.name || null,
      p_email: data.email || null,
      p_phone: data.phone || null,
      p_admin_id: (await supabase.auth.getUser()).data.user?.id || null,
      p_user_agent: userAgent
    });

    if (error) {
      throw new Error(`Database error: ${error.message}`);
    }

    const resultData = result as unknown as DatabaseOperationResult;
    if (!resultData.success) {
      const errorMessage = Array.isArray(resultData.errors) 
        ? resultData.errors.join(', ') 
        : resultData.message || 'Failed to update customer';
      throw new Error(errorMessage);
    }

    // Fetch the updated customer data
    const { data: customerData, error: fetchError } = await supabase
      .from('customers')
      .select('*')
      .eq('id', id)
      .maybeSingle();

    if (fetchError || !customerData) {
      throw new Error('Customer updated but failed to retrieve updated data');
    }

    return customerData as CustomerDb;

  } catch (error: any) {
    // Enhanced error handling with specific error types
    if (error.message.includes('not found')) {
      throw new Error('Customer not found. The customer may have been deleted.');
    } else if (error.message.includes('already exists')) {
      throw new Error('Another customer with this email already exists. Please use a different email address.');
    } else if (error.message.includes('Invalid email')) {
      throw new Error('Please enter a valid email address.');
    } else if (error.message.includes('Phone number')) {
      throw new Error('Please enter a valid phone number with at least 10 digits.');
    } else if (error.message.includes('cannot be empty')) {
      throw new Error('Customer name and email cannot be empty.');
    } else {
      console.error('Customer update error:', error);
      throw new Error(error.message || 'Failed to update customer. Please try again.');
    }
  }
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

  // Fetch registered customers
  const { data: registeredCustomers, error: registeredError } = await supabase
    .from('customer_accounts')
    .select(`
      id,
      user_id,
      name,
      phone,
      created_at
    `);

  if (registeredError) throw new Error(registeredError.message);

  // Create a map to store user emails - we'll get them from orders
  const userEmailMap = new Map<string, string>();

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

  // First, collect emails from orders for registered customers
  allOrders?.forEach(order => {
    if (order.customer_id && order.customer_email) {
      userEmailMap.set(order.customer_id, order.customer_email);
    }
  });

  // Add registered customers to bucket
  registeredCustomers?.forEach(customer => {
    const customerKey = `reg:${customer.id}`;
    const email = userEmailMap.get(customer.id) || '';
    
    // Fix name vs email issue - if name looks like email, extract name from email
    let displayName = customer.name;
    if (customer.name && customer.name.includes('@')) {
      // Extract name from email (part before @)
      displayName = customer.name.split('@')[0].replace(/[._]/g, ' ');
      displayName = displayName.charAt(0).toUpperCase() + displayName.slice(1);
    }
    
    bucket[customerKey] = {
      id: customer.id,
      name: displayName || (email ? email.split('@')[0] : 'Unknown User'),
      email: email,
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

  // Get email statuses for all customers
  const emailStatuses = await getCustomerEmailStatuses(customers.map(c => c.email).filter(email => email));
  
  // Add email status to customers
  customers.forEach(customer => {
    const emailStatus = emailStatuses[customer.email];
    if (emailStatus) {
      customer.emailStatus = emailStatus.status;
      customer.emailSentAt = emailStatus.sentAt;
      customer.emailLastAttempt = emailStatus.lastAttempt;
    } else {
      customer.emailStatus = 'none';
    }
  });

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
