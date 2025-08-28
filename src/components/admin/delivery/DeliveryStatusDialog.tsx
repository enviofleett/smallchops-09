import React, { useState, useMemo } from 'react';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, PlayCircle, AlertCircle, XCircle, Clock } from 'lucide-react';

interface DeliveryAssignment {
  id: string;
  order_id: string;
  driver_id: string;
  status: 'assigned' | 'accepted' | 'in_progress' | 'completed' | 'failed' | 'cancelled';
  assigned_at: string;
  estimated_delivery_time?: string;
  delivery_notes?: string;
}

interface DeliveryStatusDialogProps {
  isOpen: boolean;
  onClose: () => void;
  assignment: DeliveryAssignment;
  onStatusUpdate: (assignmentId: string, status: DeliveryAssignment['status'], notes?: string) => Promise<void>;
}

const statusOptions = [
  { value: 'assigned', label: 'Assigned', icon: Clock, color: 'bg-blue-500' },
  { value: 'accepted', label: 'Accepted', icon: CheckCircle2, color: 'bg-green-500' },
  { value: 'in_progress', label: 'In Progress', icon: PlayCircle, color: 'bg-orange-500' },
  { value: 'completed', label: 'Completed', icon: CheckCircle2, color: 'bg-emerald-500' },
  { value: 'failed', label: 'Failed', icon: XCircle, color: 'bg-red-500' },
  { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'bg-gray-500' },
];

export function DeliveryStatusDialog({
  isOpen,
  onClose,
  assignment,
  onStatusUpdate,
}: DeliveryStatusDialogProps) {
  const [newStatus, setNewStatus] = useState<DeliveryAssignment['status']>(assignment.status);
  const [notes, setNotes] = useState<string>(assignment.delivery_notes || '');
  const [isUpdating, setIsUpdating] = useState<boolean>(false);
  const [errorMsg, setErrorMsg] = useState<string>('');

  // Memoized lookup for status options
  const currentStatusOption = useMemo(
    () => statusOptions.find(option => option.value === assignment.status),
    [assignment.status]
  );
  const newStatusOption = useMemo(
    () => statusOptions.find(option => option.value === newStatus),
    [newStatus]
  );

  const handleUpdate = async () => {
    setErrorMsg('');
    setIsUpdating(true);
    try {
      await onStatusUpdate(assignment.id, newStatus, notes);
      handleClose();
    } catch (error) {
      setErrorMsg('Status update failed, please try again.');
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setNewStatus(assignment.status);
    setNotes(assignment.delivery_notes || '');
    setErrorMsg('');
    onClose();
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Update Delivery Status</DialogTitle>
          <DialogDescription>
            Change the status of this delivery assignment
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Current Status */}
          <div className="p-3 bg-muted/30 rounded-lg">
            <p className="text-sm font-medium mb-2">Current Status:</p>
            {currentStatusOption && (
              <Badge className={`${currentStatusOption.color} text-white`} aria-label={currentStatusOption.label}>
                <currentStatusOption.icon className="w-3 h-3 mr-1" />
                {currentStatusOption.label}
              </Badge>
            )}
          </div>

          {/* New Status Selection */}
          <div className="space-y-2">
            <label htmlFor="new-status" className="text-sm font-medium">New Status:</label>
            <Select
              value={newStatus}
              onValueChange={(value) => setNewStatus(value as DeliveryAssignment['status'])}
              id="new-status"
            >
              <SelectTrigger>
                <SelectValue placeholder="Select status..." />
              </SelectTrigger>
              <SelectContent>
                {statusOptions.map((option) => {
                  const Icon = option.icon;
                  return (
                    <SelectItem key={option.value} value={option.value}>
                      <div className="flex items-center gap-2">
                        <Icon className="w-4 h-4" />
                        {option.label}
                      </div>
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          </div>

          {/* Notes */}
          <div className="space-y-2">
            <label htmlFor="delivery-notes" className="text-sm font-medium">Notes (Optional):</label>
            <Textarea
              id="delivery-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any delivery notes or comments..."
              rows={3}
            />
          </div>

          {/* Show error message if any */}
          {errorMsg && (
            <div className="text-destructive text-sm" role="alert">
              {errorMsg}
            </div>
          )}

          {/* Status Change Preview */}
          {newStatus !== assignment.status && newStatusOption && (
            <div className="p-3 border border-dashed rounded-lg">
              <p className="text-sm font-medium mb-2">Status will change to:</p>
              <Badge className={`${newStatusOption.color} text-white`} aria-label={newStatusOption.label}>
                <newStatusOption.icon className="w-3 h-3 mr-1" />
                {newStatusOption.label}
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" type="button" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            type="button"
            onClick={handleUpdate}
            disabled={newStatus === assignment.status || isUpdating}
            className="min-w-[100px]"
            aria-busy={isUpdating}
          >
            {isUpdating ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
