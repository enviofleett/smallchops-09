import { useQuery } from '@tanstack/react-query';
import {
  getDailyRevenueReport,
  getProductsSoldReport,
  getTopSellingProducts,
  getProductSalesTrends,
  getDriverRevenueReport,
  getDriverOrdersDetail,
  getAnalyticsDashboard,
} from '@/api/advancedReports';

export const useDailyRevenue = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ['daily-revenue', startDate, endDate],
    queryFn: () => getDailyRevenueReport(startDate, endDate),
    staleTime: 5 * 60 * 1000, // 5 minutes
  });
};

export const useProductsSold = (
  startDate: Date,
  endDate: Date,
  interval: 'day' | 'week' | 'month'
) => {
  return useQuery({
    queryKey: ['products-sold', startDate, endDate, interval],
    queryFn: () => getProductsSoldReport(startDate, endDate, interval),
    staleTime: 5 * 60 * 1000,
  });
};

export const useTopProducts = (startDate: Date, endDate: Date, limit: number = 10) => {
  return useQuery({
    queryKey: ['top-products', startDate, endDate, limit],
    queryFn: () => getTopSellingProducts(startDate, endDate, limit),
    staleTime: 5 * 60 * 1000,
  });
};

export const useProductTrends = (
  productId: string | null,
  startDate: Date,
  endDate: Date,
  interval: 'day' | 'week' | 'month'
) => {
  return useQuery({
    queryKey: ['product-trends', productId, startDate, endDate, interval],
    queryFn: () => productId ? getProductSalesTrends(productId, startDate, endDate, interval) : Promise.resolve([]),
    enabled: !!productId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useDriverRevenue = (
  startDate: Date,
  endDate: Date,
  interval: 'day' | 'week' | 'month'
) => {
  return useQuery({
    queryKey: ['driver-revenue', startDate, endDate, interval],
    queryFn: () => getDriverRevenueReport(startDate, endDate, interval),
    staleTime: 5 * 60 * 1000,
  });
};

export const useDriverOrders = (
  driverId: string | null,
  startDate: Date,
  endDate: Date
) => {
  return useQuery({
    queryKey: ['driver-orders', driverId, startDate, endDate],
    queryFn: () => driverId ? getDriverOrdersDetail(driverId, startDate, endDate) : Promise.resolve([]),
    enabled: !!driverId,
    staleTime: 5 * 60 * 1000,
  });
};

export const useAnalyticsDashboard = (startDate: Date, endDate: Date) => {
  return useQuery({
    queryKey: ['analytics-dashboard', startDate, endDate],
    queryFn: () => getAnalyticsDashboard(startDate, endDate),
    staleTime: 5 * 60 * 1000,
  });
};