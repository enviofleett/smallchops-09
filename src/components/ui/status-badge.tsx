import React from 'react';
import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';
import { CheckCircle, Clock, AlertCircle, XCircle, Package, Truck, Calendar } from 'lucide-react';

export type StatusType = 
  | 'success' | 'pending' | 'warning' | 'error' | 'info' 
  | 'confirmed' | 'preparing' | 'ready' | 'delivered' | 'cancelled'
  | 'paid' | 'unpaid' | 'refunded' | 'processing';

interface StatusBadgeProps {
  status: StatusType;
  children?: React.ReactNode;
  showIcon?: boolean;
  size?: 'sm' | 'default' | 'lg';
  className?: string;
}

const statusConfig: Record<StatusType, {
  variant: 'default' | 'secondary' | 'destructive' | 'outline';
  className: string;
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}> = {
  success: {
    variant: 'default',
    className: 'status-success',
    icon: CheckCircle,
    label: 'Success'
  },
  confirmed: {
    variant: 'default',
    className: 'status-success',
    icon: CheckCircle,
    label: 'Confirmed'
  },
  pending: {
    variant: 'secondary',
    className: 'status-warning',
    icon: Clock,
    label: 'Pending'
  },
  preparing: {
    variant: 'secondary',
    className: 'status-warning',
    icon: Package,
    label: 'Preparing'
  },
  ready: {
    variant: 'default',
    className: 'bg-blue-100 text-blue-800 border-blue-200',
    icon: Package,
    label: 'Ready'
  },
  delivered: {
    variant: 'default',
    className: 'status-success',
    icon: Truck,
    label: 'Delivered'
  },
  warning: {
    variant: 'secondary',
    className: 'status-warning',
    icon: AlertCircle,
    label: 'Warning'
  },
  error: {
    variant: 'destructive',
    className: 'status-error',
    icon: XCircle,
    label: 'Error'
  },
  cancelled: {
    variant: 'destructive',
    className: 'status-error',
    icon: XCircle,
    label: 'Cancelled'
  },
  info: {
    variant: 'outline',
    className: 'bg-blue-50 text-blue-700 border-blue-200',
    icon: AlertCircle,
    label: 'Info'
  },
  paid: {
    variant: 'default',
    className: 'status-success',
    icon: CheckCircle,
    label: 'Paid'
  },
  unpaid: {
    variant: 'destructive',
    className: 'status-error',
    icon: XCircle,
    label: 'Unpaid'
  },
  refunded: {
    variant: 'secondary',
    className: 'bg-orange-100 text-orange-800 border-orange-200',
    icon: AlertCircle,
    label: 'Refunded'
  },
  processing: {
    variant: 'secondary',
    className: 'status-warning',
    icon: Clock,
    label: 'Processing'
  }
};

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  status,
  children,
  showIcon = true,
  size = 'default',
  className
}) => {
  const config = statusConfig[status];
  const Icon = config.icon;

  const sizeClasses = {
    sm: 'text-xs h-5 px-2',
    default: 'text-xs h-6 px-2.5',
    lg: 'text-sm h-7 px-3'
  };

  return (
    <Badge
      variant={config.variant}
      className={cn(
        'inline-flex items-center gap-1.5 font-medium',
        config.className,
        sizeClasses[size],
        className
      )}
    >
      {showIcon && <Icon className="h-3 w-3" />}
      {children || config.label}
    </Badge>
  );
};