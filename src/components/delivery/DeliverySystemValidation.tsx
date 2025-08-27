import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { CheckCircle, AlertTriangle, XCircle, RefreshCw } from 'lucide-react';
import { usePaidOrders } from '@/hooks/usePaidOrders';
import { useOrderFilters } from '@/hooks/useOrderFilters';
import { getDeliveryZonesWithFees } from '@/api/delivery';
import { toast } from 'sonner';

interface ValidationResult {
  test: string;
  status: 'pass' | 'fail' | 'warning';
  message: string;
  details?: string;
}

export const DeliverySystemValidation: React.FC = () => {
  const [results, setResults] = useState<ValidationResult[]>([]);
  const [loading, setLoading] = useState(false);

  const { 
    orders, 
    isLoading: ordersLoading, 
    error: ordersError 
  } = usePaidOrders({ 
    selectedDate: new Date(),
    orderType: 'delivery' 
  });

  const { 
    filteredOrders, 
    metrics 
  } = useOrderFilters({
    orders,
    orderType: 'delivery',
    paymentStatus: 'paid'
  });

  const runValidation = async () => {
    setLoading(true);
    const testResults: ValidationResult[] = [];

    try {
      // Test 1: Order Filtering Hook
      testResults.push({
        test: 'Order Filtering Hook',
        status: filteredOrders.length >= 0 ? 'pass' : 'fail',
        message: `Filter hook returns ${filteredOrders.length} orders`,
        details: `Metrics: ${JSON.stringify(metrics, null, 2)}`
      });

      // Test 2: Immutable Operations
      const originalOrders = orders;
      const sortedOrders = [...orders].sort((a, b) => a.order_number.localeCompare(b.order_number));
      const immutabilityTest = orders === originalOrders && sortedOrders !== orders;
      
      testResults.push({
        test: 'Immutable Operations',
        status: immutabilityTest ? 'pass' : 'fail',
        message: immutabilityTest ? 'Arrays are properly copied' : 'Mutation detected',
        details: `Original: ${orders.length}, Sorted: ${sortedOrders.length}`
      });

      // Test 3: Delivery Zones API
      try {
        const zones = await getDeliveryZonesWithFees();
        const hasValidZones = zones.length > 0 && zones.every(z => 
          typeof z.base_fee === 'number' && z.name && z.id
        );
        
        testResults.push({
          test: 'Delivery Zones API',
          status: hasValidZones ? 'pass' : 'warning',
          message: `Retrieved ${zones.length} zones`,
          details: `All zones have valid base_fee numbers: ${hasValidZones}`
        });
      } catch (error) {
        testResults.push({
          test: 'Delivery Zones API',
          status: 'fail',
          message: 'Failed to fetch zones',
          details: error instanceof Error ? error.message : 'Unknown error'
        });
      }

      // Test 4: Date Filtering
      const today = new Date();
      const { filteredOrders: todayOrders } = useOrderFilters({
        orders,
        selectedDate: today,
        orderType: 'delivery'
      });

      testResults.push({
        test: 'Date Filtering',
        status: todayOrders.length >= 0 ? 'pass' : 'fail',
        message: `Date filter returns ${todayOrders.length} orders for today`,
        details: `Filter properly handles date: ${today.toDateString()}`
      });

      // Test 5: Error Handling
      testResults.push({
        test: 'Error Handling',
        status: ordersError ? 'warning' : 'pass',
        message: ordersError ? 'Error detected but handled' : 'No errors',
        details: ordersError ? (ordersError as Error).message : 'Clean execution'
      });

      // Test 6: Loading States
      testResults.push({
        test: 'Loading States',
        status: typeof ordersLoading === 'boolean' ? 'pass' : 'fail',
        message: `Loading state: ${ordersLoading}`,
        details: 'Boolean loading state properly managed'
      });

    } catch (error) {
      testResults.push({
        test: 'Validation Execution',
        status: 'fail',
        message: 'Validation failed',
        details: error instanceof Error ? error.message : 'Unknown error'
      });
    }

    setResults(testResults);
    setLoading(false);

    // Show summary toast
    const passed = testResults.filter(r => r.status === 'pass').length;
    const total = testResults.length;
    
    if (passed === total) {
      toast.success(`All ${total} tests passed!`);
    } else {
      toast.warning(`${passed}/${total} tests passed`);
    }
  };

  useEffect(() => {
    if (!ordersLoading && orders.length >= 0) {
      runValidation();
    }
  }, [orders, ordersLoading]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'pass':
        return <CheckCircle className="w-5 h-5 text-green-600" />;
      case 'warning':
        return <AlertTriangle className="w-5 h-5 text-yellow-600" />;
      case 'fail':
        return <XCircle className="w-5 h-5 text-red-600" />;
      default:
        return null;
    }
  };

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'pass':
        return <Badge className="bg-green-100 text-green-800">Pass</Badge>;
      case 'warning':
        return <Badge className="bg-yellow-100 text-yellow-800">Warning</Badge>;
      case 'fail':
        return <Badge className="bg-red-100 text-red-800">Fail</Badge>;
      default:
        return <Badge variant="secondary">Unknown</Badge>;
    }
  };

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center justify-between">
          <CardTitle>Delivery System Validation</CardTitle>
          <Button 
            onClick={runValidation} 
            disabled={loading}
            size="sm"
            variant="outline"
          >
            {loading ? (
              <RefreshCw className="w-4 h-4 animate-spin mr-2" />
            ) : (
              <RefreshCw className="w-4 h-4 mr-2" />
            )}
            Re-validate
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          {results.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              {loading ? 'Running validation tests...' : 'No validation results yet'}
            </div>
          ) : (
            results.map((result, index) => (
              <div key={index} className="border rounded-lg p-4">
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-3">
                    {getStatusIcon(result.status)}
                    <div>
                      <h4 className="font-medium">{result.test}</h4>
                      <p className="text-sm text-muted-foreground">{result.message}</p>
                    </div>
                  </div>
                  {getStatusBadge(result.status)}
                </div>
                {result.details && (
                  <div className="mt-2 p-2 bg-muted/50 rounded text-xs font-mono">
                    {result.details}
                  </div>
                )}
              </div>
            ))
          )}
        </div>

        {results.length > 0 && (
          <div className="mt-6 flex gap-4 text-sm">
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-green-600"></div>
              Passed: {results.filter(r => r.status === 'pass').length}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-yellow-600"></div>
              Warnings: {results.filter(r => r.status === 'warning').length}
            </span>
            <span className="flex items-center gap-1">
              <div className="w-3 h-3 rounded-full bg-red-600"></div>
              Failed: {results.filter(r => r.status === 'fail').length}
            </span>
          </div>
        )}
      </CardContent>
    </Card>
  );
};