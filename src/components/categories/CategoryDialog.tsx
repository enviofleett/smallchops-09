
import React from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Category } from '@/types/database';
import CategoryForm from './CategoryForm';
import { CategoryFormData } from '@/lib/validations/category';

interface CategoryDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  category?: Category;
  onSubmit: (data: CategoryFormData & { bannerFile?: File }) => void;
  isLoading?: boolean;
}

const CategoryDialog = ({ open, onOpenChange, category, onSubmit, isLoading }: CategoryDialogProps) => {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-full sm:max-w-2xl h-full sm:h-auto max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="text-xl">
            {category ? 'Edit Category' : 'Add New Category'}
          </DialogTitle>
        </DialogHeader>
        <div className="p-4 sm:p-0">
          <CategoryForm 
            category={category} 
            onSubmit={onSubmit} 
            isLoading={isLoading}
          />
        </div>
      </DialogContent>
    </Dialog>
  );
};

export default CategoryDialog;
