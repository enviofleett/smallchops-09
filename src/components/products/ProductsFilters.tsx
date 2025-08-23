
import React, { useState } from 'react';
import { Search, Filter, ChevronDown, X, DollarSign, Tag } from 'lucide-react';
import { Category } from '@/types/database';
import { Button } from '@/components/ui/button';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Slider } from '@/components/ui/slider';
import { Switch } from '@/components/ui/switch';

export interface FilterState {
  priceRange: [number, number];
  onlyPromotions: boolean;
  minRating: number;
}

interface ProductsFiltersProps {
  categoryFilter: string;
  onCategoryChange: (value: string) => void;
  searchQuery: string;
  onSearchChange: (value: string) => void;
  categories: Category[] | undefined;
  isLoadingCategories: boolean;
  filters: FilterState;
  onFiltersChange: (filters: FilterState) => void;
  priceRange: [number, number];
  totalProducts: number;
  filteredProducts: number;
}

const ProductsFilters = ({
  categoryFilter,
  onCategoryChange,
  searchQuery,
  onSearchChange,
  categories,
  isLoadingCategories,
  filters,
  onFiltersChange,
  priceRange,
  totalProducts,
  filteredProducts
}: ProductsFiltersProps) => {
  const [showAdvancedFilters, setShowAdvancedFilters] = useState(false);

  const hasActiveFilters = filters.onlyPromotions || 
    filters.priceRange[0] > priceRange[0] || 
    filters.priceRange[1] < priceRange[1] ||
    filters.minRating > 0;

  const activeFiltersCount = [
    filters.onlyPromotions,
    filters.priceRange[0] > priceRange[0] || filters.priceRange[1] < priceRange[1],
    filters.minRating > 0
  ].filter(Boolean).length;

  const clearAllFilters = () => {
    onFiltersChange({
      priceRange: priceRange,
      onlyPromotions: false,
      minRating: 0
    });
  };

  const handlePriceRangeChange = (value: number[]) => {
    onFiltersChange({
      ...filters,
      priceRange: [value[0], value[1]]
    });
  };

  const handlePromotionsToggle = (checked: boolean) => {
    onFiltersChange({
      ...filters,
      onlyPromotions: checked
    });
  };

  const handleRatingChange = (value: number[]) => {
    onFiltersChange({
      ...filters,
      minRating: value[0]
    });
  };

  return (
    <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-4 sm:p-6">
      {/* Main Filter Bar */}
      <div className="flex flex-col space-y-4">
        {/* Search and Category Row */}
        <div className="flex flex-col sm:flex-row sm:items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-5 w-5" />
            <input
              type="text"
              placeholder="Search products..."
              value={searchQuery}
              onChange={(e) => onSearchChange(e.target.value)}
              className="w-full pl-10 pr-4 py-2.5 bg-gray-50 border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-primary focus:border-transparent text-sm sm:text-base"
            />
          </div>
          
          <div className="flex items-center gap-3">
            <div className="relative">
              <select
                value={categoryFilter}
                onChange={(e) => onCategoryChange(e.target.value)}
                className="appearance-none bg-gray-50 border border-gray-200 rounded-xl px-3 py-2.5 pr-8 focus:outline-none focus:ring-2 focus:ring-primary text-sm sm:text-base min-w-[140px]"
                disabled={isLoadingCategories}
              >
                <option value="all">All Categories</option>
                {categories?.map((category) => (
                  <option key={category.id} value={category.id}>{category.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400 pointer-events-none" />
            </div>

            <Collapsible open={showAdvancedFilters} onOpenChange={setShowAdvancedFilters}>
              <CollapsibleTrigger asChild>
                <Button 
                  variant="outline" 
                  size="sm" 
                  className="flex items-center gap-2 whitespace-nowrap"
                >
                  <Filter className="h-4 w-4" />
                  Filters
                  {activeFiltersCount > 0 && (
                    <span className="bg-primary text-primary-foreground rounded-full text-xs px-1.5 py-0.5 min-w-[18px] h-[18px] flex items-center justify-center">
                      {activeFiltersCount}
                    </span>
                  )}
                  <ChevronDown className="h-4 w-4" />
                </Button>
              </CollapsibleTrigger>
              
              {/* Advanced Filters Content */}
              <CollapsibleContent className="absolute z-50 mt-2 right-0 w-80 max-w-[calc(100vw-2rem)] bg-white border border-gray-200 rounded-xl shadow-lg p-4">
                <div className="space-y-6">
                  {/* Filter Header */}
                  <div className="flex items-center justify-between">
                    <h3 className="font-semibold text-gray-900">Filter Products</h3>
                    {hasActiveFilters && (
                      <Button 
                        variant="ghost" 
                        size="sm" 
                        onClick={clearAllFilters}
                        className="text-xs text-gray-500 hover:text-gray-700"
                      >
                        Clear All
                      </Button>
                    )}
                  </div>

                  {/* Price Range Filter */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <DollarSign className="h-4 w-4 text-gray-500" />
                      <span className="font-medium text-sm">Price Range</span>
                    </div>
                    <div className="px-2">
                      <Slider
                        value={filters.priceRange}
                        onValueChange={handlePriceRangeChange}
                        max={priceRange[1]}
                        min={priceRange[0]}
                        step={100}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>₦{filters.priceRange[0].toLocaleString()}</span>
                        <span>₦{filters.priceRange[1].toLocaleString()}</span>
                      </div>
                    </div>
                  </div>

                  {/* Promotions Filter */}
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Tag className="h-4 w-4 text-gray-500" />
                        <span className="font-medium text-sm">Promotions Only</span>
                      </div>
                      <Switch
                        checked={filters.onlyPromotions}
                        onCheckedChange={handlePromotionsToggle}
                      />
                    </div>
                  </div>

                  {/* Minimum Rating Filter */}
                  <div className="space-y-3">
                    <div className="flex items-center gap-2">
                      <span className="font-medium text-sm">Minimum Rating</span>
                    </div>
                    <div className="px-2">
                      <Slider
                        value={[filters.minRating]}
                        onValueChange={handleRatingChange}
                        max={5}
                        min={0}
                        step={0.5}
                        className="w-full"
                      />
                      <div className="flex justify-between text-xs text-gray-500 mt-1">
                        <span>Any</span>
                        <span>{filters.minRating > 0 ? `${filters.minRating}+ stars` : 'Any'}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </CollapsibleContent>
            </Collapsible>
          </div>
        </div>

        {/* Results Summary and Active Filters */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="text-sm text-gray-600">
            {filteredProducts} of {totalProducts} products
            {hasActiveFilters && ' (filtered)'}
          </div>
          
          {/* Active Filter Tags */}
          {hasActiveFilters && (
            <div className="flex flex-wrap items-center gap-2">
              {filters.onlyPromotions && (
                <div className="flex items-center gap-1 bg-orange-100 text-orange-800 px-2 py-1 rounded-md text-xs">
                  <Tag className="h-3 w-3" />
                  Promotions
                  <button 
                    onClick={() => handlePromotionsToggle(false)}
                    className="ml-1 hover:bg-orange-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              
              {(filters.priceRange[0] > priceRange[0] || filters.priceRange[1] < priceRange[1]) && (
                <div className="flex items-center gap-1 bg-blue-100 text-blue-800 px-2 py-1 rounded-md text-xs">
                  <DollarSign className="h-3 w-3" />
                  ₦{filters.priceRange[0].toLocaleString()} - ₦{filters.priceRange[1].toLocaleString()}
                  <button 
                    onClick={() => handlePriceRangeChange(priceRange)}
                    className="ml-1 hover:bg-blue-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
              
              {filters.minRating > 0 && (
                <div className="flex items-center gap-1 bg-yellow-100 text-yellow-800 px-2 py-1 rounded-md text-xs">
                  {filters.minRating}+ ⭐
                  <button 
                    onClick={() => handleRatingChange([0])}
                    className="ml-1 hover:bg-yellow-200 rounded-full p-0.5"
                  >
                    <X className="h-3 w-3" />
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default ProductsFilters;
