import React from 'react';
import { Settings, ShieldCheck, Send, RefreshCw, Info } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { SectionHeading } from './SectionHeading';
import { OrderStatus } from '@/types/orders';
import { Constants } from '@/integrations/supabase/types';
import { EmailStatusGuide } from '../EmailStatusGuide';
import { EmailTestButton } from '../EmailTestButton';

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
  // Order details for email testing
  orderId?: string;
  customerEmail?: string;
  orderNumber?: string;
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
  verifyMessage,
  orderId,
  customerEmail,
  orderNumber
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
                  <div className="flex items-center justify-between w-full">
                    <span>{status.charAt(0).toUpperCase() + status.slice(1).replace(/_/g, ' ')}</span>
                    {['ready', 'out_for_delivery', 'delivered', 'cancelled', 'completed', 'returned'].includes(status) && (
                      <span className="text-xs text-blue-500 ml-2">📧</span>
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {['ready', 'out_for_delivery', 'delivered', 'cancelled', 'completed', 'returned'].includes(selectedStatus) && (
            <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
              📧 Customer will receive email notification for this status
            </p>
          )}
        </div>

        {/* Rider Assignment */}
        <div className="space-y-2">
          <label className="text-sm font-medium text-foreground">
            {selectedStatus === 'out_for_delivery' ? 'Reassign Dispatch Rider' : 'Assign Dispatch Rider'}
          </label>
          <Select
            value={assignedRider ?? 'unassigned'}
            onValueChange={(value) => onRiderChange(value === 'unassigned' ? null : value)}
            disabled={isLoadingRiders || !['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(selectedStatus)}
          >
            <SelectTrigger className="w-full bg-background">
              <SelectValue placeholder={
                isLoadingRiders 
                  ? "Loading riders..." 
                  : !['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(selectedStatus)
                    ? "Change status first to assign rider"
                    : "Select a rider"
              } />
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
          {!['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(selectedStatus) && (
            <p className="text-xs text-amber-600 dark:text-amber-400">
              ⚠️ Riders can only be assigned when order is confirmed, preparing, ready, or out for delivery
            </p>
          )}
          {riders?.length === 0 && !isLoadingRiders && (
            <p className="text-xs text-muted-foreground">
              ⚠️ No active dispatch riders found. Contact admin to add riders.
            </p>
          )}
          {selectedStatus === 'out_for_delivery' && (
            <p className="text-xs text-blue-600 dark:text-blue-400">
              🔄 This will reassign the rider for an order already out for delivery
            </p>
          )}
          {(['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(selectedStatus)) && (
            <p className="text-xs text-blue-600 dark:text-blue-400 flex items-center gap-1">
              🔐 Admin permissions required for rider assignment/reassignment
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

        {/* Email Automation Info */}
        <div className="pt-4 border-t border-border">
          <Collapsible>
            <CollapsibleTrigger className="flex items-center justify-between w-full p-3 rounded-lg bg-muted/50 hover:bg-muted transition-colors">
              <div className="flex items-center gap-2 text-sm font-medium">
                <Info className="h-4 w-4 text-blue-500" />
                Email Automation Status
              </div>
              <span className="text-xs text-muted-foreground">View Details</span>
            </CollapsibleTrigger>
            <CollapsibleContent className="mt-3">
              <EmailStatusGuide />
            </CollapsibleContent>
          </Collapsible>
        </div>
      </CardContent>
    </Card>
  );
};