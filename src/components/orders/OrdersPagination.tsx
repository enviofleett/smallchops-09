
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
    <div className="flex flex-col sm:flex-row items-center justify-between gap-4 px-4 md:px-6 py-4 bg-background rounded-b-2xl shadow-sm border-t border-border mt-[-1px]">
      <p className="text-sm text-muted-foreground text-center sm:text-left">
        Showing {startResult} to {endResult} of {totalResults} results
      </p>

      {totalPages > 1 && (
        <div className="flex items-center space-x-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage - 1)}
            disabled={currentPage === 1}
            className="text-xs md:text-sm"
          >
            <span className="hidden sm:inline">Previous</span>
            <span className="sm:hidden">Prev</span>
          </Button>
          <span className="px-2 text-sm text-foreground font-medium whitespace-nowrap">
            Page {currentPage} of {totalPages}
          </span>
          <Button
            variant="outline"
            size="sm"
            onClick={() => onPageChange(currentPage + 1)}
            disabled={currentPage === totalPages}
            className="text-xs md:text-sm"
          >
            Next
          </Button>
        </div>
      )}
    </div>
  );
};

export default OrdersPagination;
