import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { getPromotions, clearPromotionsCache } from '@/api/promotions';
import { getProductsWithDiscounts } from '@/api/productsWithDiscounts';

export function PromotionsDebug() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);

  const testPromotionsQuery = async () => {
    setLoading(true);
    setError(null);
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing promotions query...');
      const promotions = await getPromotions();
      const endTime = Date.now();
      
      setResult({
        success: true,
        count: promotions.length,
        duration: endTime - startTime,
        activeCount: promotions.filter(p => p.status === 'active').length,
        timestamp: new Date().toLocaleTimeString()
      });
      
      console.log(`✅ Promotions query completed in ${endTime - startTime}ms`);
    } catch (err) {
      const endTime = Date.now();
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      setError(errorMessage);
      setResult({
        success: false,
        duration: endTime - startTime,
        error: errorMessage,
        timestamp: new Date().toLocaleTimeString()
      });
      
      console.error('❌ Promotions query failed:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const testProductsWithDiscounts = async () => {
    setLoading(true);
    setError(null);
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing products with discounts query...');
      const products = await getProductsWithDiscounts();
      const endTime = Date.now();
      
      setResult({
        success: true,
        count: products.length,
        duration: endTime - startTime,
        discountedCount: products.filter(p => p.has_discount).length,
        timestamp: new Date().toLocaleTimeString()
      });
      
      console.log(`✅ Products with discounts query completed in ${endTime - startTime}ms`);
    } catch (err) {
      const endTime = Date.now();
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      setError(errorMessage);
      setResult({
        success: false,
        duration: endTime - startTime,
        error: errorMessage,
        timestamp: new Date().toLocaleTimeString()
      });
      
      console.error('❌ Products with discounts query failed:', errorMessage);
    } finally {
      setLoading(false);
    }
  };

  const clearCache = () => {
    clearPromotionsCache();
    console.log('🗑️ Promotions cache cleared');
    setResult(null);
    setError(null);
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle>🔧 Promotions Query Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={testPromotionsQuery} 
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Testing...' : 'Test Promotions Query'}
          </Button>
          
          <Button 
            onClick={testProductsWithDiscounts} 
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Testing...' : 'Test Products + Discounts'}
          </Button>
          
          <Button 
            onClick={clearCache} 
            variant="secondary"
          >
            Clear Cache
          </Button>
        </div>

        {error && (
          <div className="p-4 bg-red-50 border border-red-200 rounded-lg">
            <p className="text-red-800 font-medium">❌ Error:</p>
            <p className="text-red-600">{error}</p>
          </div>
        )}

        {result && (
          <div className={`p-4 border rounded-lg ${
            result.success ? 'bg-green-50 border-green-200' : 'bg-red-50 border-red-200'
          }`}>
            <div className="flex items-center gap-2 mb-2">
              <Badge variant={result.success ? 'default' : 'destructive'}>
                {result.success ? '✅ Success' : '❌ Failed'}
              </Badge>
              <span className="text-sm text-gray-600">{result.timestamp}</span>
            </div>
            
            <div className="space-y-1 text-sm">
              <p><strong>Duration:</strong> {result.duration}ms</p>
              {result.count !== undefined && (
                <p><strong>Total Items:</strong> {result.count}</p>
              )}
              {result.activeCount !== undefined && (
                <p><strong>Active Promotions:</strong> {result.activeCount}</p>
              )}
              {result.discountedCount !== undefined && (
                <p><strong>Products with Discounts:</strong> {result.discountedCount}</p>
              )}
              {result.error && (
                <p><strong>Error:</strong> {result.error}</p>
              )}
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Promotions are cached for 5 minutes to improve performance</p>
          <p>• Timeout protection: 3 seconds for promotions, 4-5 seconds for products</p>
          <p>• Fallback: Returns cached data on timeout, empty array if no cache</p>
        </div>
      </CardContent>
    </Card>
  );
}
