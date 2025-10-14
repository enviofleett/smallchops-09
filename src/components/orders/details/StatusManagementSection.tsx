import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Clock, RefreshCw, Shield } from "lucide-react";
import { useState } from "react";
import { OrderStatus } from "@/types/unifiedOrder";
import { format } from "date-fns";
import { useUnifiedAuth } from "@/hooks/useUnifiedAuth";

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
  // 🔒 SECURITY: Use server-backed admin verification
  const { isAdmin, isLoading: authLoading } = useUnifiedAuth();
  
  // 🔒 SECURITY: Don't render admin features for non-admins
  if (authLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-pulse">Checking permissions...</div>
          </div>
        </CardContent>
      </Card>
    );
  }
  
  if (!isAdmin) {
    return null;
  }
  
  const [selectedStatus, setSelectedStatus] = useState<OrderStatus>(currentStatus);
  const handleUpdate = async () => {
    if (selectedStatus === currentStatus) return;
    await onUpdateStatus(selectedStatus);
  };
  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Shield className="h-4 w-4 text-green-600" />
          <RefreshCw className="h-5 w-5" />
          Order Status Management
          <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs ml-auto">
            Admin Only
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Current Status Display */}
        <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg border border-border">
          <div className="flex items-center gap-2">
            <div className={`h-3 w-3 rounded-full ${getStatusColor(currentStatus)}`} />
            <span className="font-medium">{getStatusLabel(currentStatus)}</span>
          </div>
          {updatedAt && (
            <div className="flex items-center gap-1 text-sm text-muted-foreground">
              <Clock className="h-3 w-3" />
              {format(new Date(updatedAt), 'MMM dd, hh:mm a')}
            </div>
          )}
        </div>

        {/* Status Change Section */}
        <div className="space-y-2">
          <label className="text-sm font-medium">Update Order Status</label>
          <div className="flex gap-2">
            <Select
              value={selectedStatus}
              onValueChange={(value) => setSelectedStatus(value as OrderStatus)}
              disabled={isUpdating}
            >
              <SelectTrigger className="flex-1">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {STATUS_OPTIONS.map((option) => (
                  <SelectItem key={option.value} value={option.value}>
                    <div className="flex items-center gap-2">
                      <div className={`h-2.5 w-2.5 rounded-full ${option.color}`} />
                      <span>{option.label}</span>
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
            <Button
              onClick={handleUpdate}
              disabled={isUpdating || selectedStatus === currentStatus}
              size="default"
            >
              {isUpdating ? (
                <>
                  <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
                  Updating...
                </>
              ) : (
                'Update Status'
              )}
            </Button>
          </div>
        </div>

        {/* Status Progress Indicator */}
        <div className="pt-2">
          <p className="text-xs text-muted-foreground mb-2">Status Flow</p>
          <div className="flex items-center gap-1">
            {STATUS_OPTIONS.filter(s => s.value !== 'cancelled').map((status, index) => (
              <div key={status.value} className="flex items-center flex-1">
                <div
                  className={`h-1.5 rounded-full flex-1 transition-colors ${
                    STATUS_OPTIONS.findIndex(s => s.value === currentStatus) >= index
                      ? status.color
                      : 'bg-muted'
                  }`}
                />
                {index < STATUS_OPTIONS.length - 2 && (
                  <div className="h-1.5 w-1.5 rounded-full bg-muted mx-0.5" />
                )}
              </div>
            ))}
          </div>
        </div>
      </CardContent>
    </Card>
  );
}