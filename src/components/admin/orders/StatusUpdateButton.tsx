import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { useSimpleOrderStatusUpdate } from '@/hooks/useSimpleOrderStatusUpdate';
import { Badge } from '@/components/ui/badge';
import { ChevronDown, Loader2, Mail, MailCheck, MailX, AlertCircle } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useToast } from '@/hooks/use-toast';

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
  delivered: [],
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
  const [emailStatus, setEmailStatus] = useState<'pending' | 'success' | 'failed' | null>(null);
  const { updateOrderStatus, isUpdating, error } = useSimpleOrderStatusUpdate();
  const { toast } = useToast();

  const currentStatus = order.status;
  const nextStatuses = STATUS_FLOW[currentStatus as keyof typeof STATUS_FLOW] || [];

  const handleStatusUpdate = async (newStatus: string) => {
    setEmailStatus('pending');
    
    try {
      const result = await updateOrderStatus(order.id, newStatus as any);
      
      // Show success feedback
      setEmailStatus('success');
      toast({
        title: "Status Updated",
        description: `Order status changed to ${newStatus}. Customer will be notified.`,
      });
      
    } catch (error) {
      console.error('Status update error:', error);
      setEmailStatus('failed');
      // Error toast is already handled by the simple hook
    } finally {
      // Clear email status after 5 seconds
      setTimeout(() => setEmailStatus(null), 5000);
    }
  };

  const getEmailIcon = () => {
    switch (emailStatus) {
      case 'pending':
        return <Mail className="h-3 w-3 animate-pulse" />;
      case 'success':
        return <MailCheck className="h-3 w-3 text-green-600" />;
      case 'failed':
        return <MailX className="h-3 w-3 text-red-600" />;
      default:
        return null;
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
      <div className="space-y-1">
        <Button
          onClick={() => handleStatusUpdate(nextStatuses[0])}
          disabled={isUpdating}
          size="sm"
          className={cn("w-full", className)}
        >
          {isUpdating && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
          {isUpdating ? 'Updating...' : `Mark as ${STATUS_LABELS[nextStatuses[0] as keyof typeof STATUS_LABELS]}`}
        </Button>
        {emailStatus && (
          <div className={cn(
            "flex items-center justify-center gap-1 text-xs",
            emailStatus === 'success' && "text-green-600",
            emailStatus === 'failed' && "text-red-600", 
            emailStatus === 'pending' && "text-blue-600"
          )}>
            {getEmailIcon()}
            <span>
              {emailStatus === 'success' && 'Email sent'}
              {emailStatus === 'failed' && 'Email failed'}
              {emailStatus === 'pending' && 'Sending email...'}
            </span>
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-1">
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
                <ChevronDown className="h-4 w-4" />
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
      {emailStatus && (
        <div className={cn(
          "flex items-center justify-center gap-1 text-xs",
          emailStatus === 'success' && "text-green-600",
          emailStatus === 'failed' && "text-red-600", 
          emailStatus === 'pending' && "text-blue-600"
        )}>
          {getEmailIcon()}
          <span>
            {emailStatus === 'success' && 'Email sent'}
            {emailStatus === 'failed' && 'Email failed'}
            {emailStatus === 'pending' && 'Sending email...'}
          </span>
        </div>
      )}
    </div>
  );
}