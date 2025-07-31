
export interface Customer {
  id: string;
  name: string;
  email: string;
  phone?: string;
  totalOrders: number;
  totalSpent: number;
  status: 'VIP' | 'Active' | 'Inactive' | 'Registered';
  lastOrderDate: string;
  isGuest?: boolean; // NEW - true if the customer only ever checked out as guest
}

export interface CustomerDb {
  id: string;
  name: string;
  email: string;
  phone: string | null;
  created_at: string;
  updated_at: string;
}

export interface CustomerMetrics {
  totalCustomers: number;
  activeCustomers: number;
  avgOrderValue: number;
  repeatCustomerRate: number;
  guestCustomers: number;
  authenticatedCustomers: number;
}

export interface DateRange {
  from: Date;
  to: Date;
}

export interface CustomerAnalytics {
  metrics: CustomerMetrics;
  topCustomersByOrders: Customer[];
  topCustomersBySpending: Customer[];
  repeatCustomers: Customer[];
  allCustomers?: Customer[];
  customerTrends: {
    date: string;
    newCustomers: number;
    returningCustomers: number;
  }[];
}
