
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { ProductForm } from './ProductForm';
import { ProductFormData } from '@/lib/validations/product';
import { Product, Category } from '@/types/database';

interface ProductDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product?: Product;
  categories: Category[];
  onSubmit: (data: ProductFormData & { imageFile?: File }) => Promise<void>;
  isSubmitting?: boolean;
}

export const ProductDialog = ({ open, onOpenChange, product, categories, onSubmit, isSubmitting }: ProductDialogProps) => {
  const handleSubmit = async (data: ProductFormData & { imageFile?: File }) => {
    // Ensure required fields are present
    if (!data.name || typeof data.price !== 'number') {
      console.error('Missing required fields: name and price');
      return;
    }
    
    await onSubmit(data);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {product ? 'Edit Product' : 'Add New Product'}
          </DialogTitle>
        </DialogHeader>
        <ProductForm 
          product={product} 
          categories={categories}
          onSubmit={handleSubmit}
          isLoading={isSubmitting}
        />
      </DialogContent>
    </Dialog>
  );
};
