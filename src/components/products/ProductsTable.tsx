import React, { useState } from 'react';
import { Image as ImageIcon, Terminal, Edit, Trash2, Clock, Tag, CheckSquare, Square } from 'lucide-react';
import { ProductWithCategory } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';

import { FavoriteButton } from '@/components/ui/favorite-button';
import { BulkDeleteDialog } from './BulkDeleteDialog';
import { ResponsiveTable, MobileCard, MobileCardHeader, MobileCardContent, MobileCardRow, MobileCardActions } from '@/components/ui/responsive-table';

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
    return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN' }).format(amount);
};

const ProductsTable = ({ products, isLoading, isError, error, onEditProduct, onDeleteProduct }: ProductsTableProps) => {
  const [selectedProducts, setSelectedProducts] = useState<ProductWithCategory[]>([]);
  const [showBulkDelete, setShowBulkDelete] = useState(false);

  const handleSelectAll = () => {
    if (selectedProducts.length === products?.length) {
      setSelectedProducts([]);
    } else {
      setSelectedProducts(products || []);
    }
  };

  const handleSelectProduct = (product: ProductWithCategory) => {
    setSelectedProducts(prev => {
      const isSelected = prev.some(p => p.id === product.id);
      if (isSelected) {
        return prev.filter(p => p.id !== product.id);
      } else {
        return [...prev, product];
      }
    });
  };

  const isProductSelected = (product: ProductWithCategory) => {
    return selectedProducts.some(p => p.id === product.id);
  };

  const clearSelection = () => {
    setSelectedProducts([]);
  };

  const mobileComponent = (
    <div className="space-y-3">
      {selectedProducts.length > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4">
          <div className="flex items-center justify-between">
            <span className="text-sm font-medium text-blue-800">
              {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected
            </span>
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() => setShowBulkDelete(true)}
                className="text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="h-4 w-4 mr-1" />
                Delete
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={clearSelection}
                className="text-gray-600"
              >
                Clear
              </Button>
            </div>
          </div>
        </div>
      )}

      {isLoading ? (
        [...Array(3)].map((_, i) => (
          <MobileCard key={i}>
            <MobileCardHeader>
              <div className="flex items-center gap-3">
                <Skeleton className="w-4 h-4" />
                <Skeleton className="w-12 h-12 rounded-lg" />
                <div className="space-y-2">
                  <Skeleton className="h-4 w-32" />
                  <Skeleton className="h-3 w-24" />
                </div>
              </div>
            </MobileCardHeader>
          </MobileCard>
        ))
      ) : isError ? (
        <Alert variant="destructive">
          <Terminal className="h-4 w-4" />
          <AlertTitle>Error</AlertTitle>
          <AlertDescription>{error?.message}</AlertDescription>
        </Alert>
      ) : (
        products?.map((product) => (
          <MobileCard key={product.id}>
            <MobileCardHeader>
              <div className="flex items-center gap-3">
                <button
                  onClick={() => handleSelectProduct(product)}
                  className="flex items-center justify-center"
                >
                  {isProductSelected(product) ? (
                    <CheckSquare className="h-4 w-4 text-blue-600" />
                  ) : (
                    <Square className="h-4 w-4 text-gray-400" />
                  )}
                </button>
                <div className="relative w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                  {product.image_url ? (
                    <img 
                      src={product.image_url} 
                      alt={product.name} 
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                  ) : (
                    <ImageIcon className="h-6 w-6 text-gray-400" />
                  )}
                  {product.is_promotional && (
                    <div className="absolute -top-1 -right-1">
                      <PromotionalBadge className="text-xs px-1 py-0.5" />
                    </div>
                  )}
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2 mb-1">
                    <p className="font-medium text-gray-800 truncate">{product.name}</p>
                    {product.is_promotional && <PromotionalBadge className="text-xs" />}
                  </div>
                  <p className="text-sm text-gray-600">{product.categories?.name || 'N/A'}</p>
                </div>
              </div>
              <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(product.stock_quantity)}`}>
                {getStatusText(product.stock_quantity)}
              </span>
            </MobileCardHeader>
            
            <MobileCardContent>
              <MobileCardRow 
                label="SKU" 
                value={product.sku || 'N/A'} 
              />
              <MobileCardRow 
                label="Stock" 
                value={<span className={`font-medium ${product.stock_quantity === 0 ? 'text-red-600' : product.stock_quantity <= 10 ? 'text-yellow-600' : 'text-green-600'}`}>{product.stock_quantity}</span>} 
              />
              <MobileCardRow 
                label="Price" 
                value={<span className="font-semibold">{formatCurrency(product.price)}</span>} 
              />
              {product.preparation_time && (
                <MobileCardRow 
                  label="Prep Time" 
                  value={`${product.preparation_time} min`} 
                />
              )}
              {Array.isArray(product.features) && product.features.length > 0 && (
                <div className="mt-2">
                  <span className="text-sm font-medium text-gray-600">Features:</span>
                  <div className="flex flex-wrap gap-1 mt-1">
                    {(product.features as string[]).slice(0, 3).map((feature, idx) => (
                      <Badge key={idx} variant="outline" className="text-xs py-0 px-1">
                        {String(feature)}
                      </Badge>
                    ))}
                    {product.features.length > 3 && (
                      <Badge variant="outline" className="text-xs py-0 px-1">
                        +{product.features.length - 3} more
                      </Badge>
                    )}
                  </div>
                </div>
              )}
            </MobileCardContent>
            
            <MobileCardActions>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onEditProduct(product)}
                className="flex items-center gap-2"
              >
                <Edit className="w-4 h-4" />
                Edit
              </Button>
              <Button
                variant="outline"
                size="sm"
                onClick={() => onDeleteProduct(product)}
                className="flex items-center gap-2 text-red-600 border-red-200 hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" />
                Delete
              </Button>
            </MobileCardActions>
          </MobileCard>
        ))
      )}
    </div>
  );

  return (
    <>
      <ResponsiveTable
        className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden"
        mobileComponent={mobileComponent}
      >
        {selectedProducts.length > 0 && (
          <div className="bg-blue-50 border-b border-blue-200 px-6 py-3">
            <div className="flex items-center justify-between">
              <span className="text-sm font-medium text-blue-800">
                {selectedProducts.length} product{selectedProducts.length > 1 ? 's' : ''} selected
              </span>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setShowBulkDelete(true)}
                  className="text-red-600 border-red-200 hover:bg-red-50"
                >
                  <Trash2 className="h-4 w-4 mr-1" />
                  Delete Selected
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={clearSelection}
                  className="text-gray-600"
                >
                  Clear Selection
                </Button>
              </div>
            </div>
          </div>
        )}
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-100">
              <tr>
                <th className="text-left py-4 px-6 font-medium text-gray-600 w-12">
                  <button
                    onClick={handleSelectAll}
                    className="flex items-center justify-center"
                  >
                    {selectedProducts.length === products?.length && products?.length > 0 ? (
                      <CheckSquare className="h-4 w-4 text-blue-600" />
                    ) : (
                      <Square className="h-4 w-4 text-gray-400" />
                    )}
                  </button>
                </th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Product</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">SKU</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Category</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Stock</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Price</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Status</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Favorites</th>
                <th className="text-left py-4 px-6 font-medium text-gray-600">Actions</th>
              </tr>
            </thead>
            <tbody>
              {isLoading ? (
                [...Array(5)].map((_, i) => (
                  <tr key={i} className="border-b border-gray-50">
                    <td className="py-4 px-6"><Skeleton className="w-4 h-4" /></td>
                    <td className="py-4 px-6"><div className="flex items-center space-x-4"><Skeleton className="w-12 h-12 rounded-lg" /><div className="space-y-2"><Skeleton className="h-4 w-[250px]" /></div></div></td>
                    <td className="py-4 px-6"><Skeleton className="h-4 w-[150px]" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-4 w-[100px]" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-4 w-[50px]" /></td>
                    <td className="py-4 px-6"><Skeleton className="h-4 w-[80px]" /></td>
                     <td className="py-4 px-6"><Skeleton className="h-8 w-24 rounded-full" /></td>
                     <td className="py-4 px-6"><Skeleton className="h-4 w-16" /></td>
                     <td className="py-4 px-6"><div className="flex items-center space-x-2"><Skeleton className="h-8 w-16" /><span className="text-gray-300">|</span><Skeleton className="h-8 w-20" /></div></td>
                  </tr>
                ))
              ) : isError ? (
                <tr>
                  <td colSpan={9} className="text-center py-10">
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
                      <button
                        onClick={() => handleSelectProduct(product)}
                        className="flex items-center justify-center"
                      >
                        {isProductSelected(product) ? (
                          <CheckSquare className="h-4 w-4 text-blue-600" />
                        ) : (
                          <Square className="h-4 w-4 text-gray-400 hover:text-gray-600" />
                        )}
                      </button>
                    </td>
                     <td className="py-4 px-6">
                        <div className="flex items-center space-x-4">
                          <div className="relative w-12 h-12 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                            {product.image_url ? (
                              <img 
                                src={product.image_url} 
                                alt={product.name} 
                                className="w-full h-full object-cover"
                                loading="lazy"
                                onError={(e) => {
                                  e.currentTarget.style.display = 'none';
                                  e.currentTarget.nextElementSibling?.classList.remove('hidden');
                                }}
                              />
                            ) : null}
                            {!product.image_url && <ImageIcon className="h-6 w-6 text-gray-400" />}
                            <ImageIcon className="h-6 w-6 text-gray-400 hidden" />
                            {product.is_promotional && (
                              <div className="absolute -top-1 -right-1">
                                <PromotionalBadge className="text-xs px-1 py-0.5" />
                              </div>
                            )}
                          </div>
                         <div className="flex-1 min-w-0">
                           <div className="flex items-center gap-2 mb-1">
                             <p className="font-medium text-gray-800 truncate">{product.name}</p>
                             {product.is_promotional && <PromotionalBadge className="text-xs" />}
                           </div>
                           <div className="flex items-center gap-3 text-xs text-gray-500">
                             {product.preparation_time && (
                               <span className="flex items-center gap-1">
                                 <Clock className="w-3 h-3" />
                                 {product.preparation_time}min
                               </span>
                             )}
                             {Array.isArray(product.features) && product.features.length > 0 && (
                               <span className="flex items-center gap-1">
                                 <Tag className="w-3 h-3" />
                                 {product.features.length} features
                               </span>
                             )}
                           </div>
                            {Array.isArray(product.features) && product.features.length > 0 && (
                              <div className="flex flex-wrap gap-1 mt-2">
                                {(product.features as string[]).slice(0, 2).map((feature, idx) => (
                                  <Badge key={idx} variant="outline" className="text-xs py-0 px-1">
                                    {String(feature)}
                                  </Badge>
                                ))}
                                {product.features.length > 2 && (
                                  <Badge variant="outline" className="text-xs py-0 px-1">
                                    +{product.features.length - 2} more
                                  </Badge>
                                )}
                              </div>
                            )}
                         </div>
                       </div>
                     </td>
                    <td className="py-4 px-6 text-gray-600 font-mono text-sm">{product.sku || 'N/A'}</td>
                    <td className="py-4 px-6 text-gray-600">{product.categories?.name || 'N/A'}</td>
                    <td className="py-4 px-6"><span className={`font-medium ${product.stock_quantity === 0 ? 'text-red-600' : product.stock_quantity <= 10 ? 'text-yellow-600' : 'text-green-600'}`}>{product.stock_quantity}</span></td>
                    <td className="py-4 px-6 font-medium text-gray-800">{formatCurrency(product.price)}</td>
                     <td className="py-4 px-6"><span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(product.stock_quantity)}`}>{getStatusText(product.stock_quantity)}</span></td>
                     <td className="py-4 px-6 text-center text-gray-500">
                       <span className="text-sm">Admin view</span>
                     </td>
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
        
        <div className="flex flex-col sm:flex-row items-center justify-between px-4 md:px-6 py-4 bg-gray-50 border-t border-gray-100 space-y-3 sm:space-y-0">
          <p className="text-sm text-gray-600">Showing 1 to {products?.length || 0} of {products?.length || 0} results</p>
          <div className="flex items-center space-x-2">
            <button className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm">Previous</button>
            <button className="px-3 py-1 bg-blue-600 text-white rounded-lg text-sm">1</button>
            <button className="px-3 py-1 border border-gray-300 rounded-lg hover:bg-gray-100 transition-colors text-sm">Next</button>
          </div>
        </div>
      </ResponsiveTable>
      
      <BulkDeleteDialog
        open={showBulkDelete}
        onOpenChange={setShowBulkDelete}
        selectedProducts={selectedProducts}
        onClearSelection={clearSelection}
      />
    </>
  );
};

export default ProductsTable;
