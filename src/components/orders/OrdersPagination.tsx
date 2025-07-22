
import React from 'react';
import { Button } from '@/components/ui/button';

interface OrdersPaginationProps {
  currentPage: number;
  totalPages: number;
  onPageChange: (page: number) => void;
  totalResults: number;
  pageSize?: number;
}

const OrdersPagination = ({
  currentPage,
  totalPages,
  onPageChange,
  totalResults,
  pageSize = 10,
}: OrdersPaginationProps) => {
  const startResult = totalResults > 0 ? (currentPage - 1) * pageSize + 1 : 0;
  const endResult = Math.min(currentPage * pageSize, totalResults);

  return (
    <div className="flex items-center justify-between px-6 py-4 bg-white rounded-b-2xl shadow-sm border-t border-gray-100 mt-[-1px]">
      <p className="text-sm text-gray-600">
        Showing {startResult} to {endResult} of {totalResults} results
      </p>

      {totalPages > 1 && (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
          >
            Previous
          </Button>
          <span className="px-2 text-sm text-gray-700 font-medium">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default OrdersPagination;
