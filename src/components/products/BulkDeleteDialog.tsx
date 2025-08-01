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
import { bulkDeleteProducts } from '@/api/products';
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
      return await bulkDeleteProducts(productIds);
    },
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ['products'] });
      toast.success(result.message);
      onClearSelection();
      onOpenChange(false);
    },
    onError: (error) => {
      toast.error('Failed to process products: ' + error.message);
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
            Are you sure you want to remove {selectedProducts.length} selected product{selectedProducts.length > 1 ? 's' : ''}?
            <div className="mt-3 max-h-32 overflow-y-auto">
              <ul className="text-sm text-muted-foreground space-y-1">
                {selectedProducts.map(product => (
                  <li key={product.id} className="truncate">• {product.name}</li>
                ))}
              </ul>
            </div>
            <div className="mt-3 p-3 bg-blue-50 rounded-md">
              <p className="text-sm text-blue-800">
                <strong>Note:</strong> Products with existing orders will be discontinued instead of deleted to preserve order history.
              </p>
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
            {bulkDeleteMutation.isPending ? 'Processing...' : `Remove ${selectedProducts.length} Product${selectedProducts.length > 1 ? 's' : ''}`}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
};