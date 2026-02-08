import { useState, useEffect } from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import type { DashboardAggregatesResponse } from '@/types/dashboard';

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
        const { data, error } = await supabase.functions.invoke('dashboard-aggregates', {
          body: {
            limit: 2000,
            topLimit: 5
          }
        });

        if (error) {
          throw new Error(error.message);
        }

        const agg = data as DashboardAggregatesResponse;

        return {
          stats: agg.stats,
          topProducts: agg.topProducts,
          topCustomers: agg.topCustomers,
          fulfillmentStats: agg.fulfillmentStats
        };
      } catch (error) {
        console.error('Error fetching admin dashboard data:', error);
        throw error;
      }
    },
    staleTime: 5 * 60 * 1000,
    gcTime: 10 * 60 * 1000,
    refetchOnWindowFocus: false,
    retry: 2
  });
};
