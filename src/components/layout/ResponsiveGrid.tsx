import React from 'react';
import { cn } from '@/lib/utils';

interface ResponsiveGridProps {
  children: React.ReactNode;
  columns?: 1 | 2 | 3 | 4 | 5 | 6;
  gap?: 'sm' | 'md' | 'lg' | 'xl';
  className?: string;
  minItemWidth?: string;
  autoFit?: boolean;
}

export const ResponsiveGrid: React.FC<ResponsiveGridProps> = ({
  children,
  columns = 3,
  gap = 'md',
  className,
  minItemWidth,
  autoFit = false
}) => {
  const gapClasses = {
    sm: 'gap-2',
    md: 'gap-4',
    lg: 'gap-6',
    xl: 'gap-8'
  };

  const columnClasses = {
    1: 'grid-cols-1',
    2: 'grid-cols-1 md:grid-cols-2',
    3: 'grid-cols-1 md:grid-cols-2 lg:grid-cols-3',
    4: 'grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4',
    5: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5',
    6: 'grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 2xl:grid-cols-6'
  };

  if (autoFit && minItemWidth) {
    return (
      <div 
        className={cn('grid', gapClasses[gap], className)}
        style={{ 
          gridTemplateColumns: `repeat(auto-fit, minmax(${minItemWidth}, 1fr))` 
        }}
      >
        {children}
      </div>
    );
  }

  return (
    <div className={cn(
      'grid',
      gapClasses[gap],
      columnClasses[columns],
      className
    )}>
      {children}
    </div>
  );
};