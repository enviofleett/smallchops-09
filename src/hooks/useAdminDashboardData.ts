import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';

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

export interface AdminDashboardData {
  stats: AdminDashboardStats;
  topProducts: TopProduct[];
  topCustomers: TopCustomer[];
  fulfillmentStats: FulfillmentStats;
}

export const useAdminDashboardData = () => {
  return useQuery<AdminDashboardData>({
    queryKey: ['admin-dashboard'],
    queryFn: async () => {
      try {
        // Fetch basic stats
        const [
          { data: products },
          { data: orders },
          { data: customers }
        ] = await Promise.all([
          supabase.from('products').select('id'),
          supabase.from('orders').select('id, total_amount, status, order_type'),
          supabase.from('customer_accounts').select('id')
        ]);

        // Calculate basic stats
        const totalProducts = products?.length || 0;
        const totalOrders = orders?.length || 0;
        const totalCustomers = customers?.length || 0;
        const totalRevenue = orders?.reduce((sum, order) => 
          sum + (parseFloat(order.total_amount?.toString() || '0') || 0), 0) || 0;

        // Fetch top selling products
        const { data: topProductsData } = await supabase
          .from('order_items')
          .select(`
            product_id,
            product_name,
            quantity,
            total_price,
            order_id
          `)
          .limit(1000);

        // Calculate top products
        const productMap = new Map<string, TopProduct>();
        topProductsData?.forEach(item => {
          const key = item.product_id;
          if (productMap.has(key)) {
            const existing = productMap.get(key)!;
            existing.quantity_sold += item.quantity;
            existing.revenue += parseFloat(item.total_price?.toString() || '0') || 0;
            existing.total_orders += 1;
          } else {
            productMap.set(key, {
              id: item.product_id,
              name: item.product_name,
              quantity_sold: item.quantity,
              revenue: parseFloat(item.total_price?.toString() || '0') || 0,
              total_orders: 1
            });
          }
        });

        const topProducts = Array.from(productMap.values())
          .sort((a, b) => b.quantity_sold - a.quantity_sold)
          .slice(0, 5);

        // Fetch top customers by orders
        const { data: customerOrdersData } = await supabase
          .from('orders')
          .select(`
            customer_id,
            customer_name,
            customer_email,
            total_amount
          `)
          .not('customer_id', 'is', null);

        // Calculate top customers
        const customerMap = new Map<string, TopCustomer>();
        customerOrdersData?.forEach(order => {
          const key = order.customer_id;
          if (customerMap.has(key)) {
            const existing = customerMap.get(key)!;
            existing.total_orders += 1;
            existing.total_spent += parseFloat(order.total_amount?.toString() || '0') || 0;
          } else {
            customerMap.set(key, {
              id: order.customer_id,
              name: order.customer_name || 'Unknown',
              email: order.customer_email || '',
              total_orders: 1,
              total_spent: parseFloat(order.total_amount?.toString() || '0') || 0
            });
          }
        });

        const topCustomers = Array.from(customerMap.values())
          .sort((a, b) => b.total_orders - a.total_orders)
          .slice(0, 5);

        // Calculate fulfillment statistics
        const deliveryOrders = orders?.filter(order => order.order_type === 'delivery').length || 0;
        const pickupOrders = orders?.filter(order => order.order_type === 'pickup').length || 0;
        const totalFulfillmentOrders = deliveryOrders + pickupOrders;

        const fulfillmentStats: FulfillmentStats = {
          delivery_orders: deliveryOrders,
          pickup_orders: pickupOrders,
          delivery_percentage: totalFulfillmentOrders > 0 ? 
            Math.round((deliveryOrders / totalFulfillmentOrders) * 100) : 0,
          pickup_percentage: totalFulfillmentOrders > 0 ? 
            Math.round((pickupOrders / totalFulfillmentOrders) * 100) : 0,
          total_fulfillment_orders: totalFulfillmentOrders
        };

        return {
          stats: {
            totalProducts,
            totalOrders,
            totalCustomers,
            totalRevenue
          },
          topProducts,
          topCustomers,
          fulfillmentStats
        };
      } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
    retry: 2
  });
};