import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Clock, RefreshCw } from "lucide-react";
import { useState } from "react";
import { OrderStatus } from "@/types/unifiedOrder";
import { format } from "date-fns";

interface StatusManagementSectionProps {
  currentStatus: OrderStatus;
  orderId: string;
  updatedAt?: string;
  onUpdateStatus: (newStatus: OrderStatus) => Promise<void | boolean>;
  isUpdating: boolean;
}

const STATUS_OPTIONS: { value: OrderStatus; label: string; color: string }[] = [
  { value: 'pending', label: 'Pending', color: 'bg-yellow-500' },
  { value: 'confirmed', label: 'Confirmed', color: 'bg-blue-500' },
  { value: 'preparing', label: 'Preparing', color: 'bg-indigo-500' },
  { value: 'ready', label: 'Ready', color: 'bg-purple-500' },
  { value: 'out_for_delivery', label: 'Out for Delivery', color: 'bg-orange-500' },
  { value: 'delivered', label: 'Delivered', color: 'bg-green-500' },
  { value: 'cancelled', label: 'Cancelled', color: 'bg-red-500' },
];

function getStatusColor(status: OrderStatus): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.color || 'bg-gray-500';
}

function getStatusLabel(status: OrderStatus): string {
  return STATUS_OPTIONS.find(s => s.value === status)?.label || status;
}

export function StatusManagementSection({
  currentStatus,
  orderId,
  updatedAt,
  onUpdateStatus,
  isUpdating
}: StatusManagementSectionProps) {
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(currentStatus);

  const handleUpdate = async () => {
    if (selectedStatus === currentStatus) return;
    await onUpdateStatus(selectedStatus);
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <RefreshCw className="h-5 w-5" />
          Status Management
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="bg-muted/50 rounded-lg p-3 space-y-2">
          <div className="text-sm font-medium">Current Status</div>
          <div className="flex items-center justify-between">
            <Badge className={`${getStatusColor(currentStatus)} text-white`}>
              {getStatusLabel(currentStatus)}
            </Badge>
            {updatedAt && (
              <div className="flex items-center gap-1 text-xs text-muted-foreground">
                <Clock className="h-3 w-3" />
                {format(new Date(updatedAt), 'MMM dd, hh:mm a')}
              </div>
            )}
          </div>
        </div>

        <div className="space-y-2">
          <label className="text-sm font-medium">Update Status</label>
          <Select
            value={selectedStatus}
            onValueChange={(value) => setSelectedStatus(value as OrderStatus)}
            disabled={isUpdating}
          >
            <SelectTrigger>
              <SelectValue placeholder="Select new status" />
            </SelectTrigger>
            <SelectContent>
              {STATUS_OPTIONS.map(option => (
                <SelectItem key={option.value} value={option.value}>
                  <div className="flex items-center gap-2">
                    <div className={`w-2 h-2 rounded-full ${option.color}`} />
                    {option.label}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <Button
          onClick={handleUpdate}
          disabled={isUpdating || selectedStatus === currentStatus}
          className="w-full"
        >
          {isUpdating ? 'Updating...' : 'Update Status'}
        </Button>
      </CardContent>
    </Card>
  );
}
