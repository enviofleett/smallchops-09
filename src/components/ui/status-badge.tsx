import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { cva, type VariantProps } from 'class-variance-authority';

const statusBadgeVariants = cva(
  "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
  {
    variants: {
      variant: {
        default: "border-transparent bg-primary text-primary-foreground hover:bg-primary/80",
        secondary: "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80",
        destructive: "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/80",
        outline: "text-foreground",
        pending: "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300",
        confirmed: "border-transparent bg-blue-100 text-blue-800 dark:bg-blue-900 dark:text-blue-300",
        preparing: "border-transparent bg-orange-100 text-orange-800 dark:bg-orange-900 dark:text-orange-300",
        ready: "border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
        out_for_delivery: "border-transparent bg-purple-100 text-purple-800 dark:bg-purple-900 dark:text-purple-300",
        delivered: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
        completed: "border-transparent bg-emerald-100 text-emerald-800 dark:bg-emerald-900 dark:text-emerald-300",
        cancelled: "border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
        paid: "border-transparent bg-green-100 text-green-800 dark:bg-green-900 dark:text-green-300",
        unpaid: "border-transparent bg-gray-100 text-gray-800 dark:bg-gray-900 dark:text-gray-300",
        failed: "border-transparent bg-red-100 text-red-800 dark:bg-red-900 dark:text-red-300",
        refunded: "border-transparent bg-yellow-100 text-yellow-800 dark:bg-yellow-900 dark:text-yellow-300"
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof statusBadgeVariants> {
  status?: string;
  children?: React.ReactNode;
}

const StatusBadge = React.forwardRef<HTMLDivElement, StatusBadgeProps>(
  ({ className, variant, status, children, ...props }, ref) => {
    // Auto-map status to variant if no explicit variant provided
    const mappedVariant = variant || (status as any) || 'default';
    
    return (
      <Badge
        className={cn(statusBadgeVariants({ variant: mappedVariant }), className)}
        {...props}
      >
        {children || (status && status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' '))}
      </Badge>
    );
  }
);
StatusBadge.displayName = "StatusBadge";

export { StatusBadge, statusBadgeVariants };