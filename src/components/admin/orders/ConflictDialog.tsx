import React from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, User, Clock } from 'lucide-react';
import { safeFormatDate } from '@/utils/safeDateFormat';

interface ConflictDialogProps {
  conflictInfo: {
    orderId: string;
    currentVersion: number;
    currentStatus: string;
    lastUpdatedBy: string;
    lastUpdatedAt: string;
    attemptedStatus: string;
  };
  onResolve: (action: 'accept' | 'override' | 'cancel') => void;
}

export function ConflictDialog({ conflictInfo, onResolve }: ConflictDialogProps) {
  const getStatusLabel = (status: string) => {
    const labels = {
      pending: 'Pending',
      confirmed: 'Confirmed',
      preparing: 'Preparing',
      ready: 'Ready',
      out_for_delivery: 'Out for Delivery',
      delivered: 'Delivered',
      cancelled: 'Cancelled',
      completed: 'Completed'
    };
    return labels[status as keyof typeof labels] || status;
  };

  return (
    <Dialog open={true} onOpenChange={() => onResolve('cancel')}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-amber-500" />
            Order Update Conflict
          </DialogTitle>
          <DialogDescription>
            Another admin has updated this order while you were making changes.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Conflict Info */}
          <div className="bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg p-4">
            <div className="space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Current Status:</span>
                <Badge variant="outline">
                  {getStatusLabel(conflictInfo.currentStatus)}
                </Badge>
              </div>

              <div className="flex items-center justify-between">
                <span className="text-sm font-medium">Your Attempted Status:</span>
                <Badge variant="secondary">
                  {getStatusLabel(conflictInfo.attemptedStatus)}
                </Badge>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <User className="h-4 w-4" />
                <span>Updated by: {conflictInfo.lastUpdatedBy}</span>
              </div>

              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Clock className="h-4 w-4" />
                <span>
                  At: {safeFormatDate(conflictInfo.lastUpdatedAt, 'MMM dd, yyyy HH:mm')}
                </span>
              </div>
            </div>
          </div>

          {/* Options Explanation */}
          <div className="space-y-2 text-sm text-muted-foreground">
            <p><strong>Accept Changes:</strong> Keep the current status and refresh your view</p>
            <p><strong>Override:</strong> Force your status update (not recommended)</p>
            <p><strong>Cancel:</strong> Go back without making changes</p>
          </div>
        </div>

        <DialogFooter className="flex gap-2">
          <Button
            variant="outline"
            onClick={() => onResolve('cancel')}
          >
            Cancel
          </Button>
          
          <Button
            variant="secondary"
            onClick={() => onResolve('accept')}
          >
            Accept Changes
          </Button>
          
          <Button
            variant="destructive"
            onClick={() => onResolve('override')}
          >
            Override
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}