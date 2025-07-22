
import React, { useState, useMemo } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';

import { getProducts, createProduct, updateProduct } from '@/api/products';
import { getCategories } from '@/api/categories';
import { ProductWithCategory, Category } from '@/types/database';
import { ProductFormData } from '@/lib/validations/product';

import ProductsHeader from '@/components/products/ProductsHeader';
import ProductsFilters from '@/components/products/ProductsFilters';
import ProductsTable from '@/components/products/ProductsTable';
import { ProductDialog } from '@/components/products/ProductDialog';
import { DeleteProductDialog } from '@/components/products/DeleteProductDialog';

const Products = () => {
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isDeleteDialogOpen, setIsDeleteDialogOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<ProductWithCategory | null>(null);

  const queryClient = useQueryClient();

  const {
    data: products,
    isLoading: isLoadingProducts,
    isError: isErrorProducts,
    error: errorProducts
  } = useQuery<ProductWithCategory[], Error>({
    queryKey: ['products'],
    queryFn: getProducts,
  });

  const {
    data: categories,
    isLoading: isLoadingCategories,
  } = useQuery<Category[], Error>({
    queryKey: ['categories'],
    queryFn: getCategories,
  });

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
    if (!products) return [];
    
    let filtered = products;
    
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
  }, [products, categoryFilter, searchQuery]);

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
    // Ensure required fields are present for create/update
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
  };

  const isSubmitting = createMutation.isPending || updateMutation.isPending;

  return (
    <div className="space-y-6">
      <ProductsHeader onAddProduct={handleAddProduct} />
      
      <ProductsFilters 
        categoryFilter={categoryFilter}
        onCategoryChange={setCategoryFilter}
        searchQuery={searchQuery}
        onSearchChange={setSearchQuery}
        categories={categories}
        isLoadingCategories={isLoadingCategories}
      />
      
      <ProductsTable
        products={filteredProducts}
        isLoading={isLoadingProducts}
        isError={isErrorProducts}
        error={errorProducts}
        onEditProduct={handleEditProduct}
        onDeleteProduct={handleDeleteProduct}
      />

      <ProductDialog
        open={isProductDialogOpen}
        onOpenChange={setIsProductDialogOpen}
        product={selectedProduct || undefined}
        categories={categories || []}
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
