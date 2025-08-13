import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getOrders } from '@/api/orders';
import { getRoutes } from '@/api/routes';
import { getDrivers } from '@/api/drivers';
import { CheckCircle, XCircle, Clock } from 'lucide-react';

export function SystemStatusChecker() {
  // Test API connections
  const { data: ordersData, error: ordersError, isLoading: ordersLoading } = useQuery({
    queryKey: ['system-test-orders'],
    queryFn: () => getOrders({ page: 1, pageSize: 1 }),
  });

  const { data: routes, error: routesError, isLoading: routesLoading } = useQuery({
    queryKey: ['system-test-routes'],
    queryFn: () => getRoutes(),
  });

  const { data: drivers, error: driversError, isLoading: driversLoading } = useQuery({
    queryKey: ['system-test-drivers'],
    queryFn: () => getDrivers(),
  });

  const getStatusBadge = (loading: boolean, error: any, data: any) => {
    if (loading) return <Badge variant="secondary"><Clock className="w-3 h-3 mr-1" />Loading</Badge>;
    if (error) return <Badge variant="destructive"><XCircle className="w-3 h-3 mr-1" />Error</Badge>;
    return <Badge variant="default"><CheckCircle className="w-3 h-3 mr-1" />OK</Badge>;
  };

  return (
    <Card className="mb-6">
      <CardHeader>
        <CardTitle>System Status Check</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="flex items-center justify-between">
            <span>Orders API</span>
            {getStatusBadge(ordersLoading, ordersError, ordersData)}
          </div>
          <div className="flex items-center justify-between">
            <span>Routes API</span>
            {getStatusBadge(routesLoading, routesError, routes)}
          </div>
          <div className="flex items-center justify-between">
            <span>Drivers API</span>
            {getStatusBadge(driversLoading, driversError, drivers)}
          </div>
        </div>
        {(ordersError || routesError || driversError) && (
          <div className="mt-4 p-3 bg-destructive/10 rounded-lg">
            <p className="text-sm text-destructive">
              Errors detected: Check console for details
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}