import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

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
  });

  const updateMutation = useMutation({
    mutationFn: ({ id, data }: { id: string; data: any }) => updateProduct(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      setIsProductDialogOpen(false);
      setSelectedProduct(null);
    },
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
        product.name.toLowerCase().includes(query) ||
        product.sku?.toLowerCase().includes(query) ||
        product.description?.toLowerCase().includes(query)
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
      const safeData = {
        ...data,
        name: data.name ?? "",
        price: data.price ?? 0,
        stock_quantity: data.stock_quantity ?? 0,
        status: data.status ?? "draft",
      };
      
      if (selectedProduct) {
        await updateMutation.mutateAsync({ id: selectedProduct.id, data: safeData });
      } else {
        await createMutation.mutateAsync(safeData);
      }
    } catch (error: any) {
      if (error.message?.includes('SKU') && error.message?.includes('already exists')) {
        throw new Error(error.message + ' Try modifying the SKU or leave it blank for auto-generation.');
      }
      throw error;
    }
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <ProductsHeader onAddProduct={handleAddProduct} />
      
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
