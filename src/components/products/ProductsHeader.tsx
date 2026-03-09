import React from 'react';
import { Button } from '@/components/ui/button';
import { Plus, Download } from 'lucide-react';

interface ProductsHeaderProps {
  onAddProduct: () => void;
  onExportCsv?: () => void;
  isExporting?: boolean;
}

const ProductsHeader = ({ onAddProduct, onExportCsv, isExporting }: ProductsHeaderProps) => {
  return (
    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between">
      <div>
        <h1 className="text-3xl font-bold text-foreground">Products</h1>
        <p className="text-muted-foreground mt-2">Manage your product inventory</p>
      </div>
      <div className="flex items-center gap-2 mt-4 sm:mt-0">
        <Button
          variant="outline"
          onClick={onExportCsv}
          disabled={isExporting}
          className="px-4 py-2.5 rounded-xl"
        >
          <Download className="h-4 w-4 mr-2" />
          {isExporting ? 'Exporting…' : 'Export CSV'}
        </Button>
        <Button
          onClick={onAddProduct}
          className="bg-gradient-to-r from-blue-600 to-purple-600 text-white px-6 py-2.5 rounded-xl hover:shadow-lg transition-all"
        >
          <Plus className="h-4 w-4 mr-2" />
          Add Product
        </Button>
      </div>
    </div>
  );
};

export default ProductsHeader;
