import React, { useState } from 'react';
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
  onStatusUpdate: (assignmentId: string, status: string, notes?: string) => void;
}

export function DeliveryStatusDialog({
  isOpen,
  onClose,
  assignment,
  onStatusUpdate
}: DeliveryStatusDialogProps) {
  const [newStatus, setNewStatus] = useState(assignment.status);
  const [notes, setNotes] = useState(assignment.delivery_notes || '');
  const [isUpdating, setIsUpdating] = useState(false);

  const statusOptions = [
    { value: 'assigned', label: 'Assigned', icon: Clock, color: 'bg-blue-500' },
    { value: 'accepted', label: 'Accepted', icon: CheckCircle2, color: 'bg-green-500' },
    { value: 'in_progress', label: 'In Progress', icon: PlayCircle, color: 'bg-orange-500' },
    { value: 'completed', label: 'Completed', icon: CheckCircle2, color: 'bg-emerald-500' },
    { value: 'failed', label: 'Failed', icon: XCircle, color: 'bg-red-500' },
    { value: 'cancelled', label: 'Cancelled', icon: XCircle, color: 'bg-gray-500' },
  ];

  const currentStatusOption = statusOptions.find(option => option.value === assignment.status);
  const newStatusOption = statusOptions.find(option => option.value === newStatus);

  const handleUpdate = async () => {
    setIsUpdating(true);
    try {
      await onStatusUpdate(assignment.id, newStatus, notes);
      onClose();
    } catch (error) {
      console.error('Status update failed:', error);
    } finally {
      setIsUpdating(false);
    }
  };

  const handleClose = () => {
    setNewStatus(assignment.status);
    setNotes(assignment.delivery_notes || '');
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
              <Badge className={`${currentStatusOption.color} text-white`}>
                <currentStatusOption.icon className="w-3 h-3 mr-1" />
                {currentStatusOption.label}
              </Badge>
            )}
          </div>

          {/* New Status Selection */}
          <div className="space-y-2">
            <label className="text-sm font-medium">New Status:</label>
            <Select value={newStatus} onValueChange={(value) => setNewStatus(value as typeof newStatus)}>
              <SelectTrigger>
                <SelectValue />
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
            <label className="text-sm font-medium">Notes (Optional):</label>
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any delivery notes or comments..."
              rows={3}
            />
          </div>

          {/* Status Change Preview */}
          {newStatus !== assignment.status && newStatusOption && (
            <div className="p-3 border border-dashed rounded-lg">
              <p className="text-sm font-medium mb-2">Status will change to:</p>
              <Badge className={`${newStatusOption.color} text-white`}>
                <newStatusOption.icon className="w-3 h-3 mr-1" />
                {newStatusOption.label}
              </Badge>
            </div>
          )}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={handleClose}>
            Cancel
          </Button>
          <Button 
            onClick={handleUpdate}
            disabled={newStatus === assignment.status || isUpdating}
            className="min-w-[100px]"
          >
            {isUpdating ? 'Updating...' : 'Update Status'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}