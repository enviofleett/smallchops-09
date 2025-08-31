import React from 'react';
import { Settings, ShieldCheck, Send, RefreshCw } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { SectionHeading } from './SectionHeading';
import { OrderStatus } from '@/types/orders';
import { Constants } from '@/integrations/supabase/types';

interface DispatchRider {
  id: string;
  name: string;
  vehicle_brand?: string;
  vehicle_model?: string;
  license_plate?: string;
}

interface ActionsDrawerProps {
  selectedStatus: OrderStatus;
  onStatusChange: (status: OrderStatus) => void;
  assignedRider: string | null;
  onRiderChange: (riderId: string | null) => void;
  riders?: DispatchRider[];
  isLoadingRiders?: boolean;
  manualStatus: OrderStatus | '';
  onManualStatusChange: (status: OrderStatus | '') => void;
  onManualSend: () => void;
  onUpdate: () => void;
  onVerifyPayment: () => void;
  paymentReference?: string;
  isUpdating?: boolean;
  isSendingManual?: boolean;
  isVerifying?: boolean;
  verifyState?: 'idle' | 'success' | 'failed' | 'pending';
  verifyMessage?: string | null;
}

export const ActionsPanel: React.FC<ActionsDrawerProps> = ({
  selectedStatus,
  onStatusChange,
  assignedRider,
  onRiderChange,
  riders,
  isLoadingRiders,
  manualStatus,
  onManualStatusChange,
  onManualSend,
  onUpdate,
  onVerifyPayment,
  paymentReference,
  isUpdating,
  isSendingManual,
  isVerifying,
  verifyState = 'idle',
  verifyMessage
}) => {
  return (
    <Card>
      <CardContent className="p-4 sm:p-6 space-y-6">
        <SectionHeading 
          title="Order Actions" 
          icon={Settings} 
        />
        
        {/* Status Update */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Update Status</label>
          <Select value={selectedStatus} onValueChange={(value) => onStatusChange(value as OrderStatus)}>
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder="Select status" />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50">
              {Constants.public.Enums.order_status.map((status) => (
                <SelectItem key={status} value={status}>
                  {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Rider Assignment */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Assign Dispatch Rider</label>
          <Select
            value={assignedRider ?? 'unassigned'}
            onValueChange={(value) => onRiderChange(value === 'unassigned' ? null : value)}
            disabled={isLoadingRiders}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder={isLoadingRiders ? "Loading riders..." : "Select a rider"} />
            </SelectTrigger>
            <SelectContent className="bg-background border shadow-lg z-50 max-h-[200px] overflow-y-auto">
              <SelectItem value="unassigned">Unassigned</SelectItem>
              {riders?.length === 0 && !isLoadingRiders && (
                <SelectItem value="" disabled>No active riders available</SelectItem>
              )}
              {riders?.map((rider) => (
                <SelectItem key={rider.id} value={rider.id}>
                  <div className="flex flex-col py-1">
                    <span className="font-medium">{rider.name}</span>
                    {(rider.vehicle_brand || rider.vehicle_model || rider.license_plate) && (
                      <span className="text-xs text-muted-foreground">
                        {rider.vehicle_brand} {rider.vehicle_model} • {rider.license_plate}
                      </span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {riders?.length === 0 && !isLoadingRiders && (
            <p className="text-xs text-muted-foreground">
              ⚠️ No active dispatch riders found. Contact admin to add riders.
            </p>
          )}
        </div>

        {/* Manual Notification */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Send Manual Notification</label>
          <div className="flex flex-col sm:flex-row gap-2">
            <Select value={manualStatus} onValueChange={(value) => onManualStatusChange(value as OrderStatus)}>
              <SelectTrigger className="flex-1 bg-background">
                <SelectValue placeholder="Select notification type" />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50">
                {Constants.public.Enums.order_status.map((status) => (
                  <SelectItem key={status} value={status}>
                    {status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button 
              variant="secondary" 
              onClick={onManualSend}
              disabled={!manualStatus || isSendingManual}
              className="w-full sm:w-auto"
            >
              <Send className="w-4 h-4 mr-2" />
              {isSendingManual ? 'Sending...' : 'Send'}
            </Button>
          </div>
        </div>

        {/* Payment Verification */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">Payment Verification</label>
          <div className="space-y-2">
            <div className="text-xs text-muted-foreground font-mono break-all bg-muted rounded p-2">
              Ref: {paymentReference || '—'}
            </div>
            {verifyState !== 'idle' && verifyMessage && (
              <div className={`text-xs p-2 rounded ${
                verifyState === 'success' ? 'text-green-700 bg-green-50 dark:text-green-300 dark:bg-green-950' : 
                verifyState === 'pending' ? 'text-amber-700 bg-amber-50 dark:text-amber-300 dark:bg-amber-950' : 
                'text-red-700 bg-red-50 dark:text-red-300 dark:bg-red-950'
              }`}>
                {verifyState === 'pending' ? (
                  <div className="flex items-center gap-2">
                    <RefreshCw className="h-3 w-3 animate-spin" />
                    Verifying...
                  </div>
                ) : (
                  verifyMessage
                )}
              </div>
            )}
            <Button 
              onClick={onVerifyPayment}
              disabled={isVerifying || !paymentReference}
              className="w-full"
              variant="outline"
            >
              <ShieldCheck className="w-4 h-4 mr-2" />
              {isVerifying ? 'Verifying...' : 'Verify with Paystack'}
            </Button>
          </div>
        </div>

        {/* Update Button */}
        <div className="pt-4 border-t border-border">
          <Button 
            onClick={onUpdate} 
            disabled={isUpdating} 
            className="w-full"
            size="lg"
          >
            {isUpdating ? (
              <>
                <RefreshCw className="w-4 h-4 mr-2 animate-spin" />
                Updating...
              </>
            ) : (
              'Update Order'
            )}
          </Button>
        </div>
      </CardContent>
    </Card>
  );
};