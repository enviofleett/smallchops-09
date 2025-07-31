import React from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog';
import { deleteProduct } from '@/api/products';
import { ProductWithCategory } from '@/types/database';
import { toast } from '@/components/ui/sonner';

interface BulkDeleteDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  selectedProducts: ProductWithCategory[];
  onClearSelection: () => void;
}

export const BulkDeleteDialog = ({ 
  open, 
  onOpenChange, 
  selectedProducts, 
  onClearSelection 
}: BulkDeleteDialogProps) => {
  const queryClient = useQueryClient();

  const bulkDeleteMutation = useMutation({
    mutationFn: async (productIds: string[]) => {
      // Delete products one by one since we don't have a bulk delete API
      const deletePromises = productIds.map(id => deleteProduct(id));
      await Promise.all(deletePromises);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(`Successfully deleted ${selectedProducts.length} product${selectedProducts.length > 1 ? 's' : ''}`);
      onClearSelection();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to delete some products: ' + error.message);
    },
  });

  const handleBulkDelete = () => {
    const productIds = selectedProducts.map(product => product.id);
    bulkDeleteMutation.mutate(productIds);
  };

  return (
    <AlertDialog open={open} onOpenChange={onOpenChange}>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete Products</AlertDialogTitle>
          <AlertDialogDescription>
            Are you sure you want to delete {selectedProducts.length} selected product{selectedProducts.length > 1 ? 's' : ''}? 
            This action cannot be undone.
            <div className="mt-3 max-h-32 overflow-y-auto">
              <ul className="text-sm text-gray-600 space-y-1">
                {selectedProducts.map(product => (
                  <li key={product.id} className="truncate">• {product.name}</li>
                ))}
              </ul>
            </div>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleBulkDelete}
            className="bg-red-600 hover:bg-red-700"
            disabled={bulkDeleteMutation.isPending}
          >
            {bulkDeleteMutation.isPending ? 'Deleting...' : `Delete ${selectedProducts.length} Product${selectedProducts.length > 1 ? 's' : ''}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};