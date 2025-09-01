import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Button } from '@/components/ui/button';
import { ChevronDown, ChevronUp, MoreHorizontal } from 'lucide-react';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Checkbox } from '@/components/ui/checkbox';
import { cn } from '@/lib/utils';
import { useIsMobile } from '@/hooks/use-mobile';

interface Column<T> {
  key: keyof T | string;
  title: string;
  render?: (value: any, item: T, index: number) => React.ReactNode;
  sortable?: boolean;
  width?: string;
  className?: string;
  mobileHidden?: boolean;
}

interface EnhancedTableProps<T> {
  data: T[];
  columns: Column<T>[];
  loading?: boolean;
  selectable?: boolean;
  selectedItems?: T[];
  onSelectionChange?: (items: T[]) => void;
  actions?: (item: T, index: number) => React.ReactNode;
  sortBy?: string;
  sortDirection?: 'asc' | 'desc';
  onSort?: (key: string) => void;
  emptyMessage?: string;
  className?: string;
  rowClassName?: (item: T, index: number) => string;
  getRowId?: (item: T) => string | number;
}

export function EnhancedTable<T>({
  data,
  columns,
  loading = false,
  selectable = false,
  selectedItems = [],
  onSelectionChange,
  actions,
  sortBy,
  sortDirection,
  onSort,
  emptyMessage = "No data available",
  className,
  rowClassName,
  getRowId
}: EnhancedTableProps<T>) {
  const isMobile = useIsMobile();

  const visibleColumns = isMobile 
    ? columns.filter(col => !col.mobileHidden)
    : columns;

  const handleSelectAll = (checked: boolean) => {
    if (onSelectionChange) {
      onSelectionChange(checked ? data : []);
    }
  };

  const handleSelectItem = (item: T, checked: boolean) => {
    if (onSelectionChange) {
      const newSelection = checked
        ? [...selectedItems, item]
        : selectedItems.filter(selected => 
            getRowId ? getRowId(selected) !== getRowId(item) : selected !== item
          );
      onSelectionChange(newSelection);
    }
  };

  const isSelected = (item: T): boolean => {
    return selectedItems.some(selected => 
      getRowId ? getRowId(selected) === getRowId(item) : selected === item
    );
  };

  const allSelected = data.length > 0 && selectedItems.length === data.length;
  const someSelected = selectedItems.length > 0 && !allSelected;

  if (loading) {
    return (
      <div className="responsive-table">
        <Table className={className}>
          <TableHeader>
            <TableRow>
              {selectable && (
                <TableHead className="w-12">
                  <div className="w-4 h-4 bg-muted animate-pulse rounded" />
                </TableHead>
              )}
              {visibleColumns.map((column, index) => (
                <TableHead key={index} className={column.className}>
                  <div className="h-4 bg-muted animate-pulse rounded w-20" />
                </TableHead>
              ))}
              {actions && <TableHead className="w-12" />}
            </TableRow>
          </TableHeader>
          <TableBody>
            {Array.from({ length: 5 }).map((_, index) => (
              <TableRow key={index}>
                {selectable && (
                  <TableCell>
                    <div className="w-4 h-4 bg-muted animate-pulse rounded" />
                  </TableCell>
                )}
                {visibleColumns.map((_, colIndex) => (
                  <TableCell key={colIndex}>
                    <div className="h-4 bg-muted animate-pulse rounded w-24" />
                  </TableCell>
                ))}
                {actions && (
                  <TableCell>
                    <div className="w-8 h-8 bg-muted animate-pulse rounded" />
                  </TableCell>
                )}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </div>
    );
  }

  if (data.length === 0) {
    return (
      <div className="text-center py-12">
        <p className="text-muted-foreground">{emptyMessage}</p>
      </div>
    );
  }

  return (
    <div className="responsive-table">
      <Table className={className}>
        <TableHeader>
          <TableRow>
            {selectable && (
              <TableHead className="w-12">
                <Checkbox
                  checked={allSelected}
                  onCheckedChange={handleSelectAll}
                  aria-label="Select all items"
                  className={someSelected ? "data-[state=checked]:bg-primary data-[state=checked]:border-primary" : ""}
                />
              </TableHead>
            )}
            {visibleColumns.map((column) => (
              <TableHead 
                key={String(column.key)} 
                className={cn(column.className, column.width && `w-[${column.width}]`)}
              >
                {column.sortable && onSort ? (
                  <Button
                    variant="ghost"
                    size="sm"
                    className="h-auto p-0 font-medium hover:bg-transparent"
                    onClick={() => onSort(String(column.key))}
                  >
                    {column.title}
                    {sortBy === column.key && (
                      sortDirection === 'asc' 
                        ? <ChevronUp className="ml-2 h-4 w-4" />
                        : <ChevronDown className="ml-2 h-4 w-4" />
                    )}
                  </Button>
                ) : (
                  column.title
                )}
              </TableHead>
            ))}
            {actions && <TableHead className="w-12" />}
          </TableRow>
        </TableHeader>
        <TableBody>
          {data.map((item, index) => (
            <TableRow 
              key={getRowId ? getRowId(item) : index}
              className={cn(
                "hover:bg-muted/50 transition-colors",
                rowClassName?.(item, index)
              )}
            >
              {selectable && (
                <TableCell>
                  <Checkbox
                    checked={isSelected(item)}
                    onCheckedChange={(checked) => handleSelectItem(item, checked as boolean)}
                    aria-label={`Select item ${index + 1}`}
                  />
                </TableCell>
              )}
              {visibleColumns.map((column) => (
                <TableCell key={String(column.key)} className={column.className}>
                  {column.render 
                    ? column.render(
                        typeof column.key === 'string' && column.key.includes('.') 
                          ? column.key.split('.').reduce((obj, key) => obj?.[key], item)
                          : (item as any)[column.key], 
                        item, 
                        index
                      )
                    : String(
                        typeof column.key === 'string' && column.key.includes('.') 
                          ? column.key.split('.').reduce((obj, key) => obj?.[key], item) || ''
                          : (item as any)[column.key] || ''
                      )}
                </TableCell>
              ))}
              {actions && (
                <TableCell>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
                        <MoreHorizontal className="h-4 w-4" />
                        <span className="sr-only">Open menu</span>
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end" className="w-48">
                      {actions(item, index)}
                    </DropdownMenuContent>
                  </DropdownMenu>
                </TableCell>
              )}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  );
}