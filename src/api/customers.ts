import { supabase } from '@/integrations/supabase/client';
import { formatAddress } from '@/utils/formatAddress';
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
  return (data ?? []).map(order => ({
    ...order,
    delivery_address: formatAddress(order.delivery_address),
    order_type: order.order_type as string,
    status: order.status as string
  }));
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

// Updated getCustomerAnalytics to use new database functions
export const getCustomerAnalytics = async (dateRange: DateRange): Promise<CustomerAnalytics> => {
  const { from, to } = dateRange;

  try {
    // Use the new safe analytics function
    const { data: analyticsResult, error: analyticsError } = await supabase
      .rpc('get_customer_analytics_safe', {
        p_start_date: from.toISOString(),
        p_end_date: to.toISOString()
      });

    if (analyticsError) {
      console.error('Analytics function error:', analyticsError);
      throw new Error(`Failed to get analytics: ${analyticsError.message}`);
    }

    // Get all customers for display WITH DATE FILTERING
    const { data: customersResult, error: customersError } = await supabase
      .rpc('get_all_customers_display', {
        p_start_date: from.toISOString(),
        p_end_date: to.toISOString()
      });

    if (customersError) {
      console.error('Customers function error:', customersError);
      throw new Error(`Failed to get customers: ${customersError.message}`);
    }

    // Parse the results
    const analytics = analyticsResult as any;
    const allCustomers: Customer[] = (customersResult as any[]) || [];

    // Get email statuses for all customers
    const emailStatuses = await getCustomerEmailStatuses(allCustomers.map(c => c.email).filter(email => email));
    
    // Add email status to customers
    allCustomers.forEach(customer => {
      const emailStatus = emailStatuses[customer.email];
      if (emailStatus) {
        customer.emailStatus = emailStatus.status;
        customer.emailSentAt = emailStatus.sentAt;
        customer.emailLastAttempt = emailStatus.lastAttempt;
      } else {
        customer.emailStatus = 'none';
      }
    });

    // Calculate additional data for analysis
    const topCustomersByOrders = allCustomers
      .filter(c => c.totalOrders > 0)
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 10);
    
    const topCustomersBySpending = allCustomers
      .filter(c => c.totalSpent > 0)
      .sort((a, b) => b.totalSpent - a.totalSpent)
      .slice(0, 10);
    
    const repeatCustomers = allCustomers
      .filter(c => c.totalOrders > 1)
      .sort((a, b) => b.totalOrders - a.totalOrders)
      .slice(0, 10);

    return {
      metrics: analytics.metrics,
      topCustomersByOrders,
      topCustomersBySpending,
      repeatCustomers,
      allCustomers,
      customerTrends: [], // for future use
    };

  } catch (error: any) {
    console.error('Customer analytics error:', error);
    // Return safe fallback data
    return {
      metrics: {
        totalCustomers: 0,
        activeCustomers: 0,
        avgOrderValue: 0,
        repeatCustomerRate: 0,
        guestCustomers: 0,
        authenticatedCustomers: 0
      },
      topCustomersByOrders: [],
      topCustomersBySpending: [],
      repeatCustomers: [],
      allCustomers: [],
      customerTrends: []
    };
  }
};
