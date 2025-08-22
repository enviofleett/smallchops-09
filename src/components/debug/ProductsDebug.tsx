import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { 
  getProductsWithDiscounts, 
  getProductWithDiscounts,
  clearAllProductsCaches,
  getProductsCacheStatus 
} from '@/api/productsWithDiscounts';

export function ProductsDebug() {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const [cacheStatus, setCacheStatus] = useState<any>(null);

  const testProductsQuery = async () => {
    setLoading(true);
    setError(null);
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing products query...');
      const products = await getProductsWithDiscounts();
      const endTime = Date.now();
      
      setResult({
        success: true,
        count: products.length,
        duration: endTime - startTime,
        discountedCount: products.filter(p => p.has_discount).length,
        timestamp: new Date().toLocaleTimeString(),
        type: 'all_products'
      });
      
      console.log(`✅ Products query completed in ${endTime - startTime}ms`);
    } catch (err) {
      const endTime = Date.now();
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      setError(errorMessage);
      setResult({
        success: false,
        duration: endTime - startTime,
        error: errorMessage,
        timestamp: new Date().toLocaleTimeString(),
        type: 'all_products'
      });
      
      console.error('❌ Products query failed:', errorMessage);
    } finally {
      setLoading(false);
      updateCacheStatus();
    }
  };

  const testCategoryQuery = async () => {
    setLoading(true);
    setError(null);
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing category products query...');
      // Use a test category ID - you might need to adjust this
      const products = await getProductsWithDiscounts('test-category');
      const endTime = Date.now();
      
      setResult({
        success: true,
        count: products.length,
        duration: endTime - startTime,
        discountedCount: products.filter(p => p.has_discount).length,
        timestamp: new Date().toLocaleTimeString(),
        type: 'category_products'
      });
      
      console.log(`✅ Category products query completed in ${endTime - startTime}ms`);
    } catch (err) {
      const endTime = Date.now();
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      setError(errorMessage);
      setResult({
        success: false,
        duration: endTime - startTime,
        error: errorMessage,
        timestamp: new Date().toLocaleTimeString(),
        type: 'category_products'
      });
      
      console.error('❌ Category products query failed:', errorMessage);
    } finally {
      setLoading(false);
      updateCacheStatus();
    }
  };

  const testSingleProduct = async () => {
    setLoading(true);
    setError(null);
    const startTime = Date.now();
    
    try {
      console.log('🔍 Testing single product query...');
      // Use a test product ID - you might need to adjust this
      const product = await getProductWithDiscounts('test-product-id');
      const endTime = Date.now();
      
      setResult({
        success: true,
        found: !!product,
        hasDiscount: product?.has_discount || false,
        duration: endTime - startTime,
        timestamp: new Date().toLocaleTimeString(),
        type: 'single_product'
      });
      
      console.log(`✅ Single product query completed in ${endTime - startTime}ms`);
    } catch (err) {
      const endTime = Date.now();
      const errorMessage = err instanceof Error ? err.message : 'Unknown error';
      
      setError(errorMessage);
      setResult({
        success: false,
        duration: endTime - startTime,
        error: errorMessage,
        timestamp: new Date().toLocaleTimeString(),
        type: 'single_product'
      });
      
      console.error('❌ Single product query failed:', errorMessage);
    } finally {
      setLoading(false);
      updateCacheStatus();
    }
  };

  const clearCache = () => {
    clearAllProductsCaches();
    console.log('🗑️ Products cache cleared');
    setResult(null);
    setError(null);
    updateCacheStatus();
  };

  const updateCacheStatus = () => {
    const status = getProductsCacheStatus();
    setCacheStatus(status);
  };

  const formatDuration = (ms: number) => {
    if (ms < 1000) return `${ms}ms`;
    return `${(ms / 1000).toFixed(2)}s`;
  };

  const formatAge = (age: number | null) => {
    if (!age) return 'N/A';
    if (age < 60000) return `${Math.round(age / 1000)}s ago`;
    return `${Math.round(age / 60000)}m ago`;
  };

  React.useEffect(() => {
    updateCacheStatus();
  }, []);

  return (
    <Card className="w-full max-w-4xl">
      <CardHeader>
        <CardTitle>🔧 Products Query Performance Debug</CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex gap-2 flex-wrap">
          <Button 
            onClick={testProductsQuery} 
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Testing...' : 'Test All Products'}
          </Button>
          
          <Button 
            onClick={testCategoryQuery} 
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Testing...' : 'Test Category Products'}
          </Button>

          <Button 
            onClick={testSingleProduct} 
            disabled={loading}
            variant="outline"
          >
            {loading ? 'Testing...' : 'Test Single Product'}
          </Button>
          
          <Button 
            onClick={clearCache} 
            variant="secondary"
          >
            Clear Cache
          </Button>

          <Button 
            onClick={updateCacheStatus} 
            variant="ghost"
          >
            Refresh Status
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
              <Badge variant="outline">{result.type}</Badge>
            </div>
            
            <div className="space-y-1 text-sm">
              <p><strong>Duration:</strong> {formatDuration(result.duration)}</p>
              {result.count !== undefined && (
                <p><strong>Products Found:</strong> {result.count}</p>
              )}
              {result.discountedCount !== undefined && (
                <p><strong>With Discounts:</strong> {result.discountedCount}</p>
              )}
              {result.found !== undefined && (
                <p><strong>Product Found:</strong> {result.found ? 'Yes' : 'No'}</p>
              )}
              {result.hasDiscount !== undefined && (
                <p><strong>Has Discount:</strong> {result.hasDiscount ? 'Yes' : 'No'}</p>
              )}
              {result.error && (
                <p><strong>Error:</strong> {result.error}</p>
              )}
            </div>
          </div>
        )}

        {cacheStatus && (
          <div className="p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <h4 className="font-medium mb-2">📊 Cache Status</h4>
            
            <div className="space-y-2 text-sm">
              <div>
                <strong>Products Cache:</strong>
                <ul className="ml-4 mt-1">
                  <li>Active: {cacheStatus.productsCache.exists ? '✅ Yes' : '❌ No'}</li>
                  {cacheStatus.productsCache.exists && (
                    <>
                      <li>Age: {formatAge(cacheStatus.productsCache.age)}</li>
                      <li>Items: {cacheStatus.productsCache.itemCount}</li>
                      <li>Category: {cacheStatus.productsCache.categoryId || 'All'}</li>
                    </>
                  )}
                </ul>
              </div>
              
              <div>
                <strong>Single Product Cache:</strong>
                <ul className="ml-4 mt-1">
                  <li>Entries: {cacheStatus.singleProductCache.entries}</li>
                  {cacheStatus.singleProductCache.products.length > 0 && (
                    <li>
                      Recent: {cacheStatus.singleProductCache.products
                        .slice(0, 3)
                        .map(p => `${p.id} (${formatAge(p.age)})`)
                        .join(', ')}
                    </li>
                  )}
                </ul>
              </div>
            </div>
          </div>
        )}

        <div className="text-xs text-gray-500 space-y-1">
          <p>• Products are cached for 3 minutes to improve performance</p>
          <p>• Single products are cached for 5 minutes</p>
          <p>• Timeout protection: 3s → 6s → 10s progressive timeouts</p>
          <p>• Fallback: Returns cached data on timeout, empty array if no cache</p>
          <p>• Optimized queries with limited fields and pagination</p>
        </div>
      </CardContent>
    </Card>
  );
}
