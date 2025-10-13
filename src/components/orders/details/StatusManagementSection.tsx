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
const STATUS_OPTIONS: {
  value: OrderStatus;
  label: string;
  color: string;
}[] = [{
  value: 'pending',
  label: 'Pending',
  color: 'bg-yellow-500'
}, {
  value: 'confirmed',
  label: 'Confirmed',
  color: 'bg-blue-500'
}, {
  value: 'preparing',
  label: 'Preparing',
  color: 'bg-indigo-500'
}, {
  value: 'ready',
  label: 'Ready',
  color: 'bg-purple-500'
}, {
  value: 'out_for_delivery',
  label: 'Out for Delivery',
  color: 'bg-orange-500'
}, {
  value: 'delivered',
  label: 'Delivered',
  color: 'bg-green-500'
}, {
  value: 'cancelled',
  label: 'Cancelled',
  color: 'bg-red-500'
}];
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
  return <Card>
      
      
    </Card>;
}