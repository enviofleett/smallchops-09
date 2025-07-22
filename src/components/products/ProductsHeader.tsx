
import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus } from 'lucide-react';

interface ProductsHeaderProps {
  onAddProduct: () => void;
}

const ProductsHeader = ({ onAddProduct }: ProductsHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Products</h1>
        <p className="text-gray-600 mt-2">Manage your product inventory</p>
      </div>
      <Button
        onClick={onAddProduct}
        className="mt-4 sm:mt-0 bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl hover:shadow-lg transition-all"
      >
        <Plus className="h-4 w-4 mr-2" />
        Add Product
      </Button>
    </div>
  );
};

export default ProductsHeader;
