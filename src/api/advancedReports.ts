import { supabase } from '@/integrations/supabase/client';
import { format } from 'date-fns';

/**
 * Advanced Reports API Client
 * Production-ready with comprehensive error handling and type safety
 */

export interface DailyRevenueReport {
  date: string;
  total_revenue: number;
  total_orders: number;
  avg_order_value: number;
}

export interface ProductsSoldReport {
  interval_start: string;
  product_id: string;
  product_name: string;
  units_sold: number;
  total_revenue: number;
  avg_price: number;
}

export interface TopSellingProduct {
  product_id: string;
  product_name: string;
  total_units_sold: number;
  total_revenue: number;
  number_of_orders: number;
  avg_order_quantity: number;
}

export interface ProductTrend {
  interval_start: string;
  units_sold: number;
  revenue: number;
  orders_count: number;
}

export interface DriverRevenueReport {
  interval_start: string;
  driver_id: string;
  driver_name: string;
  total_deliveries: number;
  total_revenue: number;
  total_delivery_fees: number;
  avg_delivery_fee: number;
}

export interface DriverOrderDetail {
  order_id: string;
  order_number: string;
  order_date: string;
  customer_name: string;
  delivery_address: any;
  delivery_fee: number;
  total_amount: number;
  status: string;
}

// API Functions
export async function getDailyRevenueReport(
  startDate: Date,
  endDate: Date
): Promise<DailyRevenueReport[]> {
  const { data, error } = await supabase.rpc('get_daily_revenue_report', {
    p_start_date: format(startDate, 'yyyy-MM-dd'),
    p_end_date: format(endDate, 'yyyy-MM-dd'),
  });

  if (error) throw new Error(`Failed to fetch daily revenue: ${error.message}`);
  return data || [];
}

export async function getProductsSoldReport(
  startDate: Date,
  endDate: Date,
  interval: 'day' | 'week' | 'month' = 'day'
): Promise<ProductsSoldReport[]> {
  const { data, error } = await supabase.rpc('get_products_sold_report', {
    p_start_date: format(startDate, 'yyyy-MM-dd'),
    p_end_date: format(endDate, 'yyyy-MM-dd'),
    p_interval: interval,
  });

  if (error) throw new Error(`Failed to fetch products sold: ${error.message}`);
  return data || [];
}

export async function getTopSellingProducts(
  startDate: Date,
  endDate: Date,
  limit: number = 10
): Promise<TopSellingProduct[]> {
  const { data, error } = await supabase.rpc('get_top_selling_products', {
    p_start_date: format(startDate, 'yyyy-MM-dd'),
    p_end_date: format(endDate, 'yyyy-MM-dd'),
    p_limit: limit,
  });

  if (error) throw new Error(`Failed to fetch top products: ${error.message}`);
  return data || [];
}

export async function getProductSalesTrends(
  productId: string,
  startDate: Date,
  endDate: Date,
  interval: 'day' | 'week' | 'month' = 'day'
): Promise<ProductTrend[]> {
  const { data, error } = await supabase.rpc('get_product_sales_trends', {
    p_product_id: productId,
    p_start_date: format(startDate, 'yyyy-MM-dd'),
    p_end_date: format(endDate, 'yyyy-MM-dd'),
    p_interval: interval,
  });

  if (error) throw new Error(`Failed to fetch product trends: ${error.message}`);
  return data || [];
}

export async function getDriverRevenueReport(
  startDate: Date,
  endDate: Date,
  interval: 'day' | 'week' | 'month' = 'day'
): Promise<DriverRevenueReport[]> {
  const { data, error } = await supabase.rpc('get_driver_revenue_report', {
    p_start_date: format(startDate, 'yyyy-MM-dd'),
    p_end_date: format(endDate, 'yyyy-MM-dd'),
    p_interval: interval,
  });

  if (error) throw new Error(`Failed to fetch driver revenue: ${error.message}`);
  return data || [];
}

export async function getDriverOrdersDetail(
  driverId: string,
  startDate: Date,
  endDate: Date
): Promise<DriverOrderDetail[]> {
  const { data, error } = await supabase.rpc('get_driver_orders_detail', {
    p_driver_id: driverId,
    p_start_date: format(startDate, 'yyyy-MM-dd'),
    p_end_date: format(endDate, 'yyyy-MM-dd'),
  });

  if (error) throw new Error(`Failed to fetch driver orders: ${error.message}`);
  return data || [];
}

export async function getAnalyticsDashboard(
  startDate: Date,
  endDate: Date
): Promise<any> {
  const { data, error } = await supabase.rpc('get_analytics_dashboard', {
    p_start_date: format(startDate, 'yyyy-MM-dd'),
    p_end_date: format(endDate, 'yyyy-MM-dd'),
  });

  if (error) throw new Error(`Failed to fetch analytics dashboard: ${error.message}`);
  return data;
}

// CSV Export Utility
export function exportToCSV(data: any[], filename: string) {
  if (!data || data.length === 0) return;
  
  const headers = Object.keys(data[0]);
  const csvContent = [
    headers.join(','),
    ...data.map(row => 
      headers.map(header => {
        const value = row[header];
        if (value === null || value === undefined) return '';
        if (typeof value === 'string' && value.includes(',')) {
          return `"${value}"`;
        }
        return value;
      }).join(',')
    )
  ].join('\n');

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', filename);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}