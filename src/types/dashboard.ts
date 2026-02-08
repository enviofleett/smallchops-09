export interface AdminDashboardStats {
  totalProducts: number;
  totalOrders: number;
  totalCustomers: number;
  totalRevenue: number;
}

export interface TopProduct {
  id: string;
  name: string;
  quantity_sold: number;
  revenue: number;
  total_orders: number;
}

export interface TopCustomer {
  id: string;
  name: string;
  email: string;
  total_orders: number;
  total_spent: number;
}

export interface FulfillmentStats {
  delivery_orders: number;
  pickup_orders: number;
  delivery_percentage: number;
  pickup_percentage: number;
  total_fulfillment_orders: number;
}

export interface DeliverySummary {
  delivered: number;
  out_for_delivery: number;
  preparing: number;
}

export interface AdvancedSummary {
  period: { from: string | null; to: string | null };
  revenue: number;
  orders: number;
}

export interface DriverRevenue {
  interval_start: string;
  driver_id: string;
  driver_name: string;
  total_deliveries: number;
  total_revenue: number;
  total_delivery_fees: number;
  avg_delivery_fee: number;
}

export interface ZoneFeeBreakdown {
  zone_id: string;
  zone_name: string;
  total_orders: number;
  total_fees: number;
  average_fee: number;
}

export interface OverdueStats {
  critical: number; // > 30 mins
  moderate: number; // > 10 mins
  recent: number;   // > 0 mins
  total_overdue: number;
}

export interface RouteEfficiencyStats {
  average_delivery_time_minutes: number;
  orders_per_driver_avg: number;
  total_distance_km: number;
}

export interface DashboardAggregatesResponse {
  stats: AdminDashboardStats;
  topProducts: TopProduct[];
  topCustomers: TopCustomer[];
  fulfillmentStats: FulfillmentStats;
  deliverySummary: DeliverySummary;
  advancedSummary: AdvancedSummary;
  driverRevenue: DriverRevenue[];
  zoneBreakdown: ZoneFeeBreakdown[];
  overdueStats: OverdueStats;
  efficiencyStats: RouteEfficiencyStats;
  meta: {
    dateFrom: string | null;
    dateTo: string | null;
    limit: number;
    topLimit: number;
    interval: 'day' | 'week' | 'month';
    generatedAt: string;
  };
}
