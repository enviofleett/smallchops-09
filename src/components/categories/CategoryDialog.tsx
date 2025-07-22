
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
      <DialogContent className="sm:max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>
            {category ? 'Edit Category' : 'Add New Category'}
          </DialogTitle>
        </DialogHeader>
        <CategoryForm 
          category={category} 
          onSubmit={onSubmit} 
          isLoading={isLoading}
        />
      </DialogContent>
    </Dialog>
  );
};

export default CategoryDialog;
