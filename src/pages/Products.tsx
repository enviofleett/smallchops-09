import React, { useState, useMemo, useCallback } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

import { getProducts, createProduct, updateProduct } from '@/api/products';
import { getOptimizedCategories } from '@/api/optimizedProducts';
import { ProductWithCategory, Category } from '@/types/database';
import { ProductFormData } from '@/lib/validations/product';

import ProductsHeader from '@/components/products/ProductsHeader';
import SimpleProductsFilters from '@/components/products/SimpleProductsFilters';
import ProductsTable from '@/components/products/ProductsTable';
import { ProductDialog } from '@/components/products/ProductDialog';
import { DeleteProductDialog } from '@/components/products/DeleteProductDialog';
import { useNetworkResilience } from '@/hooks/useNetworkResilience';

const Products = () => {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);

  const queryClient = useQueryClient();

  // Use network resilience wrapper for better error handling
  const rawProductsQuery = useQuery<ProductWithCategory[], Error>({
    queryKey: ['products'],
    queryFn: getProducts,
    staleTime: 2 * 60 * 1000, // 2 minutes
    refetchOnWindowFocus: false,
  });

  const productsQuery = useNetworkResilience(
    rawProductsQuery,
    {
      fallbackData: [],
      showToast: true,
    }
  );

  const rawCategoriesQuery = useQuery({
    queryKey: ['categories', 'optimized'],
    queryFn: getOptimizedCategories,
    staleTime: 10 * 60 * 1000, // 10 minutes
    refetchOnWindowFocus: false,
  });

  const categoriesQuery = useNetworkResilience(
    rawCategoriesQuery,
    {
      fallbackData: [] as Category[],
      showToast: false,
    }
  );

  const createMutation = useMutation({
    mutationFn: createProduct,
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsProductDialogOpen(false);
      setSelectedProduct(null);
    },
    onError: (error: any) => {
      console.error('Product creation mutation failed:', error);
    }
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsProductDialogOpen(false);
      setSelectedProduct(null);
    },
    onError: (error: any) => {
      console.error('Product update mutation failed:', error);
    }
  });

  const filteredProducts = useMemo(() => {
    if (!productsQuery.data) return [];
    
    let filtered = productsQuery.data;
    
    // Filter by category
    if (categoryFilter !== 'all') {
      filtered = filtered.filter(product => product.category_id?.toString() === categoryFilter);
    }
    
    // Filter by search query
    if (searchQuery.trim()) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(product => 
        (product.name || '').toLowerCase().includes(query) ||
        (product.sku || '').toLowerCase().includes(query) ||
        (product.description || '').toLowerCase().includes(query)
      );
    }
    
    return filtered;
  }, [productsQuery.data, categoryFilter, searchQuery]);

  const handleAddProduct = () => {
    setSelectedProduct(null);
    setIsProductDialogOpen(true);
  };

  const handleEditProduct = (product: ProductWithCategory) => {
    setSelectedProduct(product);
    setIsProductDialogOpen(true);
  };

  const handleDeleteProduct = (product: ProductWithCategory) => {
    setSelectedProduct(product);
    setIsDeleteDialogOpen(true);
  };

  const handleSubmitProduct = async (data: ProductFormData & { imageFile?: File }) => {
    try {
      console.log('Submitting product data:', { 
        isUpdate: !!selectedProduct, 
        hasImageFile: !!data.imageFile,
        productId: selectedProduct?.id 
      });
      
      const safeData = {
        ...data,
        name: data.name ?? "",
        price: data.price ?? 0,
        stock_quantity: data.stock_quantity ?? 0,
        status: data.status ?? "draft",
      };
      
      if (selectedProduct) {
        console.log('Updating existing product...');
        await updateMutation.mutateAsync({ id: selectedProduct.id, data: safeData });
        console.log('Product update completed successfully');
      } else {
        console.log('Creating new product...');
        await createMutation.mutateAsync(safeData);
        console.log('Product creation completed successfully');
      }
    } catch (error: any) {
      console.error('Product submission failed:', error);
      
      // Handle specific error cases with user-friendly messages
      if (error.message?.includes('SKU') && error.message?.includes('already exists')) {
        throw new Error(error.message + ' Try modifying the SKU or leave it blank for auto-generation.');
      }
      
      if (error.message?.includes('Rate limit') || error.message?.includes('429')) {
        throw new Error('Upload rate limit reached. Please wait a moment and try again.');
      }
      
      if (error.message?.includes('timeout')) {
        throw new Error('Upload timed out. Please check your connection and try again.');
      }
      
      // Enhance error message for better user feedback
      if (error.message?.includes('image') || error.message?.includes('upload')) {
        throw new Error(`Image upload failed: ${error.message}. Please try again or use a different image.`);
      }
      
      throw error;
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;
  const [isExporting, setIsExporting] = useState(false);

  const handleExportCsv = useCallback(() => {
    const data = filteredProducts;
    if (!data.length) {
      toast.error('No products to export');
      return;
    }
    setIsExporting(true);
    try {
      const headers = ['Name', 'SKU', 'Price', 'Stock', 'Status', 'Category', 'Description'];
      const rows = data.map(p => [
        `"${(p.name || '').replace(/"/g, '""')}"`,
        `"${(p.sku || '').replace(/"/g, '""')}"`,
        p.price ?? '',
        p.stock_quantity ?? '',
        p.status ?? '',
        `"${(p.categories?.name || '').replace(/"/g, '""')}"`,
        `"${(p.description || '').replace(/"/g, '""')}"`,
      ]);
      const csv = [headers.join(','), ...rows.map(r => r.join(','))].join('\n');
      const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `products-${new Date().toISOString().slice(0, 10)}.csv`;
      a.click();
      URL.revokeObjectURL(url);
      toast.success(`Exported ${data.length} products`);
    } catch {
      toast.error('Export failed');
    } finally {
      setIsExporting(false);
    }
  }, [filteredProducts]);

  return (
    <div className="space-y-6">
      <ProductsHeader onAddProduct={handleAddProduct} onExportCsv={handleExportCsv} isExporting={isExporting} />
      
      <SimpleProductsFilters 
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={categoriesQuery.data as Category[]}
        isLoadingCategories={categoriesQuery.isLoading}
      />
      
      <ProductsTable
        products={filteredProducts}
        isLoading={productsQuery.isLoading}
        isError={productsQuery.isError}
        error={productsQuery.error}
        onEditProduct={handleEditProduct}
        onDeleteProduct={handleDeleteProduct}
      />

      <ProductDialog
        open={isProductDialogOpen}
        onOpenChange={setIsProductDialogOpen}
        product={selectedProduct || undefined}
        categories={(categoriesQuery.data as Category[]) || []}
        onSubmit={handleSubmitProduct}
        isSubmitting={isSubmitting}
      />

      <DeleteProductDialog
        open={isDeleteDialogOpen}
        onOpenChange={setIsDeleteDialogOpen}
        product={selectedProduct}
      />
    </div>
  );
};

export default Products;
