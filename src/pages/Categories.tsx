import React from 'react';
import CategoriesManager from '@/components/categories/CategoriesManager';
import ProductionErrorBoundary from '@/components/ui/production-error-boundary';

const Categories = () => {
  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold tracking-tight text-foreground">Categories</h1>
        <p className="text-muted-foreground">
          Manage your product categories. Organize your products by creating, editing, and managing categories.
        </p>
      </div>
      
      <div className="rounded-lg border border-border bg-card">
        <ProductionErrorBoundary context="Categories">
          <CategoriesManager />
        </ProductionErrorBoundary>
      </div>
    </div>
  );
};

export default Categories;