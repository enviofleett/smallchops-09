import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useOrderUpdate } from '@/hooks/useOrdersNew';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Loader2 } from 'lucide-react';
import { cn } from '@/lib/utils';

interface StatusUpdateButtonProps {
  order: any;
  onConflict: (conflict: any) => void;
  className?: string;
}

const STATUS_FLOW = {
  pending: ['confirmed', 'cancelled'],
  confirmed: ['preparing', 'cancelled'],
  preparing: ['ready', 'cancelled'],
  ready: ['out_for_delivery', 'cancelled'],
  out_for_delivery: ['delivered', 'cancelled'],
  delivered: ['completed'],
  cancelled: [],
  completed: []
};

const STATUS_LABELS = {
  pending: 'Pending',
  confirmed: 'Confirmed',
  preparing: 'Preparing',
  ready: 'Ready',
  out_for_delivery: 'Out for Delivery',
  delivered: 'Delivered',
  cancelled: 'Cancelled',
  completed: 'Completed'
};

const STATUS_COLORS = {
  pending: 'bg-yellow-500',
  confirmed: 'bg-blue-500',
  preparing: 'bg-orange-500',
  ready: 'bg-green-500',
  out_for_delivery: 'bg-purple-500',
  delivered: 'bg-emerald-500',
  cancelled: 'bg-red-500',
  completed: 'bg-gray-500'
};

export function StatusUpdateButton({ order, onConflict, className }: StatusUpdateButtonProps) {
  const [isUpdating, setIsUpdating] = useState(false);
  const updateMutation = useOrderUpdate();

  const currentStatus = order.status;
  const nextStatuses = STATUS_FLOW[currentStatus as keyof typeof STATUS_FLOW] || [];

  const handleStatusUpdate = async (newStatus: string) => {
    setIsUpdating(true);
    
    try {
      const result = await updateMutation.mutateAsync({
        order_id: order.id,
        new_status: newStatus,
        admin_id: order.updated_by || 'admin',
        version: order.version
      });

      if (!result.success && result.code === 'VERSION_CONFLICT') {
        onConflict({
          orderId: order.id,
          currentVersion: result.conflict?.current_version || 0,
          currentStatus: result.conflict?.current_status || '',
          lastUpdatedBy: result.conflict?.last_updated_by || '',
          lastUpdatedAt: result.conflict?.last_updated_at || '',
          attemptedStatus: newStatus
        });
      }
    } catch (error) {
      console.error('Status update error:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  if (nextStatuses.length === 0) {
    return (
      <Badge className={cn("justify-center", STATUS_COLORS[currentStatus as keyof typeof STATUS_COLORS])}>
        {STATUS_LABELS[currentStatus as keyof typeof STATUS_LABELS]}
      </Badge>
    );
  }

  if (nextStatuses.length === 1) {
    return (
      <Button
        onClick={() => handleStatusUpdate(nextStatuses[0])}
        disabled={isUpdating}
        size="sm"
        className={cn("w-full", className)}
      >
        {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
        {isUpdating ? 'Updating...' : `Mark as ${STATUS_LABELS[nextStatuses[0] as keyof typeof STATUS_LABELS]}`}
      </Button>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          disabled={isUpdating}
          className={cn("w-full justify-between", className)}
        >
          {isUpdating ? (
            <>
              <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            <>
              Update Status
              <ChevronDown className="h-4 w-4 ml-2" />
            </>
          )}
        </Button>
      </DropdownMenuTrigger>
      
      <DropdownMenuContent align="end" className="w-48">
        {nextStatuses.map((status) => (
          <DropdownMenuItem
            key={status}
            onClick={() => handleStatusUpdate(status)}
            disabled={isUpdating}
            className="flex items-center gap-2"
          >
            <div 
              className={cn("w-3 h-3 rounded-full", STATUS_COLORS[status as keyof typeof STATUS_COLORS])}
            />
            {STATUS_LABELS[status as keyof typeof STATUS_LABELS]}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}