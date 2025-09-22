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
  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <CheckCircle className="w-5 h-5" />
          System Status
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Orders API</span>
            {getStatusBadge(ordersLoading, ordersError, ordersData, 'Orders')}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Routes API</span>
            {getStatusBadge(routesLoading, routesError, routes, 'Routes')}
          </div>
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium">Drivers API</span>
            {getStatusBadge(driversLoading, driversError, drivers, 'Drivers')}
          </div>
        </div>
        {(ordersError || routesError || driversError) && (
          <div className="mt-4 p-3 bg-destructive/10 border border-destructive/20 rounded-lg">
            <h4 className="text-sm font-medium text-destructive mb-2">System Issues Detected</h4>
            <ul className="text-xs text-muted-foreground space-y-1">
              {ordersError && <li>• Orders: {ordersError.message}</li>}
              {routesError && <li>• Routes: {routesError.message}</li>}
              {driversError && <li>• Drivers: {driversError.message}</li>}
            </ul>
          </div>
        )}
        {drivers && drivers.length === 0 && (
          <div className="mt-4 p-3 bg-orange-50 border border-orange-200 rounded-lg">
            <p className="text-sm text-orange-800">
              <strong>No drivers registered:</strong> Add drivers in the Drivers tab to enable dispatch functionality.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}