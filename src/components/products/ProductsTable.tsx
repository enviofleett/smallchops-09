import React from 'react';
import { Image as ImageIcon, Terminal, Edit, Trash2 } from 'lucide-react';
import { ProductWithCategory } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';

interface ProductsTableProps {
  products: ProductWithCategory[] | undefined;
  isLoading: boolean;
  isError: boolean;
  error: Error | null;
  onEditProduct: (product: ProductWithCategory) => void;
  onDeleteProduct: (product: ProductWithCategory) => void;
}

const getStatusBadge = (stock: number) => {
    if (stock === 0) return 'bg-red-100 text-red-800';
    if (stock > 0 && stock <= 10) return 'bg-yellow-100 text-yellow-800';
    return 'bg-green-100 text-green-800';
};

const getStatusText = (stock: number) => {
    if (stock === 0) return 'Out of Stock';
    if (stock <= 10) return 'Low Stock';
    return 'In Stock';
};

const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

const ProductsTable = ({ products, isLoading, isError, error, onEditProduct, onDeleteProduct }: ProductsTableProps) => {
  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-100">
            <tr>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Product</th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">SKU</th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Category</th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Stock</th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Price</th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Status</th>
              <th className="text-left py-4 px-6 font-medium text-gray-600">Actions</th>
            </tr>
          </thead>
          <tbody>
            {isLoading ? (
              [...Array(5)].map((_, i) => (
                <tr key={i} className="border-b border-gray-50">
                  <td className="py-4 px-6"><div className="flex items-center space-x-4"><Skeleton className="w-12 h-12 rounded-lg" /><div className="space-y-2"><Skeleton className="h-4 w-[250px]" /></div></div></td>
                  <td className="py-4 px-6"><Skeleton className="h-4 w-[150px]" /></td>
                  <td className="py-4 px-6"><Skeleton className="h-4 w-[100px]" /></td>
                  <td className="py-4 px-6"><Skeleton className="h-4 w-[50px]" /></td>
                  <td className="py-4 px-6"><Skeleton className="h-4 w-[80px]" /></td>
                  <td className="py-4 px-6"><Skeleton className="h-8 w-24 rounded-full" /></td>
                  <td className="py-4 px-6"><div className="flex items-center space-x-2"><Skeleton className="h-8 w-16" /><span className="text-gray-300">|</span><Skeleton className="h-8 w-20" /></div></td>
                </tr>
              ))
            ) : isError ? (
              <tr>
                <td colSpan={7} className="text-center py-10">
                  <Alert variant="destructive" className="max-w-lg mx-auto">
                    <Terminal className="h-4 w-4" />
                    <AlertTitle>Error Fetching Products</AlertTitle>
                    <AlertDescription>{error?.message}</AlertDescription>
                  </Alert>
                </td>
              </tr>
            ) : (
              products?.map((product) => (
                <tr key={product.id} className="border-b border-gray-50 hover:bg-gray-50 transition-colors">
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                        {product.image_url ? <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" /> : <ImageIcon className="h-6 w-6 text-gray-400" />}
                      </div>
                      <div><p className="font-medium text-gray-800">{product.name}</p></div>
                    </div>
                  </td>
                  <td className="py-4 px-6 text-gray-600 font-mono text-sm">{product.sku || 'N/A'}</td>
                  <td className="py-4 px-6 text-gray-600">{product.categories?.name || 'N/A'}</td>
                  <td className="py-4 px-6"><span className={`font-medium ${product.stock_quantity === 0 ? 'text-red-600' : product.stock_quantity <= 10 ? 'text-yellow-600' : 'text-green-600'}`}>{product.stock_quantity}</span></td>
                  <td className="py-4 px-6 font-medium text-gray-800">{formatCurrency(product.price)}</td>
                  <td className="py-4 px-6"><span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(product.stock_quantity)}`}>{getStatusText(product.stock_quantity)}</span></td>
                  <td className="py-4 px-6">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditProduct(product)}
                        className="text-blue-600 hover:text-blue-700 hover:bg-blue-50"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        Edit
                      </Button>
                      <span className="text-gray-300">|</span>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteProduct(product)}
                        className="text-red-600 hover:text-red-700 hover:bg-red-50"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        Delete
                      </Button>
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between px-6 py-4 bg-gray-50 border-t border-gray-100">
        <p className="text-sm text-gray-600">Showing 1 to {products?.length || 0} of {products?.length || 0} results</p>
        <div className="flex items-center space-x-2">
          <button className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">Previous</button>
          <button className="px-3 py-1 bg-blue-600 text-white rounded-lg">1</button>
          <button className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors">Next</button>
        </div>
      </div>
    </div>
  );
};

export default ProductsTable;
