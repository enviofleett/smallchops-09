import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getOrders } from '@/api/orders';
import { getRoutes } from '@/api/routes';
import { getDrivers } from '@/api/drivers';
import { CheckCircle, XCircle, Clock } from 'lucide-react';
export function SystemStatusChecker() {
  // Test API connections with enhanced error handling
  const {
    data: ordersData,
    error: ordersError,
    isLoading: ordersLoading
  } = useQuery({
    queryKey: ['system-test-orders'],
    queryFn: async () => {
      try {
        console.log('🔍 Testing Orders API...');
        const result = await getOrders({
          page: 1,
          pageSize: 1
        });
        console.log('✅ Orders API success:', result);
        return result;
      } catch (error) {
        console.error('❌ Orders API failed:', error);
        throw error;
      }
    },
    retry: 1,
    staleTime: 30000 // 30 seconds
  });
  const {
    data: routes,
    error: routesError,
    isLoading: routesLoading
  } = useQuery({
    queryKey: ['system-test-routes'],
    queryFn: async () => {
      try {
        console.log('🔍 Testing Routes API...');
        const result = await getRoutes();
        console.log('✅ Routes API success:', result);
        return result;
      } catch (error) {
        console.error('❌ Routes API failed:', error);
        throw error;
      }
    },
    retry: 1,
    staleTime: 30000
  });
  const {
    data: drivers,
    error: driversError,
    isLoading: driversLoading
  } = useQuery({
    queryKey: ['system-test-drivers'],
    queryFn: async () => {
      try {
        console.log('🔍 Testing Drivers API...');
        const result = await getDrivers();
        console.log('✅ Drivers API success:', result);
        return result;
      } catch (error) {
        console.error('❌ Drivers API failed:', error);
        throw error;
      }
    },
    retry: 1,
    staleTime: 30000
  });
  const getStatusBadge = (loading: boolean, error: any, data: any, apiName: string) => {
    if (loading) return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Loading</Badge>;
    if (error) {
      console.error(`❌ ${apiName} API Error:`, error);
      return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
    }
    return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />OK</Badge>;
  };
  return;
}