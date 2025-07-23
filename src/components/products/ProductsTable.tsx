import React from 'react';
import { Image as ImageIcon, Terminal, Edit, Trash2 } from 'lucide-react';
import { ProductWithCategory } from '@/types/database';
import { Skeleton } from '@/components/ui/skeleton';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { MobileTable, MobileRow, MobileField, MobileHeader, MobileHeaderCell, MobileBody } from '@/components/ui/mobile-table';
import { useIsMobile } from '@/hooks/use-mobile';

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
  const isMobile = useIsMobile();

  const LoadingContent = () => (
    <>
      {[...Array(5)].map((_, i) => (
        <MobileRow key={i}>
          <MobileField label="Product">
            <div className="flex items-center space-x-4">
              <Skeleton className="w-12 h-12 rounded-lg" />
              <Skeleton className="h-4 w-[150px]" />
            </div>
          </MobileField>
          <MobileField label="SKU"><Skeleton className="h-4 w-[100px]" /></MobileField>
          <MobileField label="Category"><Skeleton className="h-4 w-[80px]" /></MobileField>
          <MobileField label="Stock"><Skeleton className="h-4 w-[50px]" /></MobileField>
          <MobileField label="Price"><Skeleton className="h-4 w-[80px]" /></MobileField>
          <MobileField label="Status"><Skeleton className="h-8 w-24 rounded-full" /></MobileField>
          <MobileField label="Actions"><Skeleton className="h-8 w-20" /></MobileField>
        </MobileRow>
      ))}
    </>
  );

  const ErrorContent = () => (
    <div className="text-center py-10">
      <Alert variant="destructive" className="max-w-lg mx-auto">
        <Terminal className="h-4 w-4" />
        <AlertTitle>Error Fetching Products</AlertTitle>
        <AlertDescription>{error?.message}</AlertDescription>
      </Alert>
    </div>
  );

  return (
    <>
      <MobileTable>
        <table className="w-full">
          <MobileHeader>
            <MobileHeaderCell>Product</MobileHeaderCell>
            <MobileHeaderCell>SKU</MobileHeaderCell>
            <MobileHeaderCell>Category</MobileHeaderCell>
            <MobileHeaderCell>Stock</MobileHeaderCell>
            <MobileHeaderCell>Price</MobileHeaderCell>
            <MobileHeaderCell>Status</MobileHeaderCell>
            <MobileHeaderCell>Actions</MobileHeaderCell>
          </MobileHeader>
          <MobileBody>
            {isLoading ? (
              <LoadingContent />
            ) : isError ? (
              <ErrorContent />
            ) : (
              products?.map((product) => (
                <MobileRow key={product.id}>
                  <MobileField label="Product">
                    <div className="flex items-center space-x-4">
                      <div className="w-12 h-12 bg-muted rounded-lg overflow-hidden flex items-center justify-center flex-shrink-0">
                        {product.image_url ? (
                          <img src={product.image_url} alt={product.name} className="w-full h-full object-cover" />
                        ) : (
                          <ImageIcon className="h-6 w-6 text-muted-foreground" />
                        )}
                      </div>
                      <p className="font-medium text-foreground">{product.name}</p>
                    </div>
                  </MobileField>
                  
                  <MobileField label="SKU">
                    <span className="text-muted-foreground font-mono text-sm">{product.sku || 'N/A'}</span>
                  </MobileField>
                  
                  <MobileField label="Category">
                    <span className="text-muted-foreground">{product.categories?.name || 'N/A'}</span>
                  </MobileField>
                  
                  <MobileField label="Stock">
                    <span className={`font-medium ${
                      product.stock_quantity === 0 ? 'text-destructive' : 
                      product.stock_quantity <= 10 ? 'text-yellow-600' : 
                      'text-green-600'
                    }`}>
                      {product.stock_quantity}
                    </span>
                  </MobileField>
                  
                  <MobileField label="Price">
                    <span className="font-medium text-foreground">{formatCurrency(product.price)}</span>
                  </MobileField>
                  
                  <MobileField label="Status">
                    <span className={`inline-block px-3 py-1 text-xs font-medium rounded-full ${getStatusBadge(product.stock_quantity)}`}>
                      {getStatusText(product.stock_quantity)}
                    </span>
                  </MobileField>
                  
                  <MobileField label="Actions">
                    <div className="flex items-center space-x-2">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onEditProduct(product)}
                        className="text-primary hover:text-primary hover:bg-primary/10"
                      >
                        <Edit className="w-4 h-4 mr-1" />
                        {!isMobile && "Edit"}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => onDeleteProduct(product)}
                        className="text-destructive hover:text-destructive hover:bg-destructive/10"
                      >
                        <Trash2 className="w-4 h-4 mr-1" />
                        {!isMobile && "Delete"}
                      </Button>
                    </div>
                  </MobileField>
                </MobileRow>
              ))
            )}
          </MobileBody>
        </table>
      </MobileTable>
      
      {!isLoading && !isError && products && (
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between px-4 sm:px-6 py-4 bg-muted/50 border-t border-border mt-4 rounded-b-2xl gap-4">
          <p className="text-sm text-muted-foreground">
            Showing 1 to {products.length} of {products.length} results
          </p>
          <div className="flex items-center space-x-2">
            <button className="px-3 py-1 border border-border rounded-lg hover:bg-accent transition-colors text-sm">
              Previous
            </button>
            <button className="px-3 py-1 bg-primary text-primary-foreground rounded-lg text-sm">
              1
            </button>
            <button className="px-3 py-1 border border-border rounded-lg hover:bg-accent transition-colors text-sm">
              Next
            </button>
          </div>
        </div>
      )}
    </>
  );
};

export default ProductsTable;
