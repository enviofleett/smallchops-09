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
    <Card className="rounded-lg border shadow-sm">
      <CardContent className="p-6 space-y-6">
        <h3 className="text-base font-semibold">Advanced Actions</h3>
        
        {/* Status Update */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Update Status</label>
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
          <label className="text-xs font-medium text-muted-foreground">
            {selectedStatus === 'out_for_delivery' ? 'Reassign Dispatch Rider' : 'Assign Dispatch Rider'}
          </label>
          
          {isLoadingRiders ? (
            <div className="w-full bg-background border rounded-md p-3 flex items-center gap-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span className="text-sm text-muted-foreground">Loading dispatch riders...</span>
            </div>
          ) : (
            <Select
              value={assignedRider ?? 'unassigned'}
              onValueChange={(value) => onRiderChange(value === 'unassigned' ? null : value)}
              disabled={!['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(selectedStatus)}
            >
              <SelectTrigger className="w-full bg-background">
                <SelectValue placeholder={
                  !['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(selectedStatus)
                    ? "Change status first to assign rider"
                    : riders?.length === 0
                      ? "No dispatch riders available"
                      : "Select a rider"
                } />
              </SelectTrigger>
              <SelectContent className="bg-background border shadow-lg z-50 max-h-[200px] overflow-y-auto">
                <SelectItem value="unassigned">
                  <div className="flex items-center gap-2">
                    <span className="text-muted-foreground">⚪</span>
                    <span>Unassigned</span>
                  </div>
                </SelectItem>
                {riders?.length === 0 && (
                  <div className="px-2 py-3 text-center">
                    <div className="text-sm text-muted-foreground mb-2">
                      <div className="mb-1">🚫 No active dispatch riders</div>
                      <div className="text-xs">Contact admin to add riders</div>
                    </div>
                  </div>
                )}
                {riders?.map((rider) => (
                  <SelectItem key={rider.id} value={rider.id}>
                    <div className="flex flex-col py-1 w-full">
                      <div className="flex items-center gap-2">
                        <span className="text-green-500">🟢</span>
                        <span className="font-medium">{rider.name}</span>
                      </div>
                      {(rider.vehicle_brand || rider.vehicle_model || rider.license_plate) && (
                        <span className="text-xs text-muted-foreground ml-5">
                          {[rider.vehicle_brand, rider.vehicle_model].filter(Boolean).join(' ')} 
                          {rider.license_plate && ` • ${rider.license_plate}`}
                        </span>
                      )}
                    </div>
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          )}
          
          {/* Status-based help text */}
          {!['confirmed', 'preparing', 'ready', 'out_for_delivery'].includes(selectedStatus) && (
            <div className="text-xs text-amber-600 dark:text-amber-400 bg-amber-50 dark:bg-amber-900/20 p-2 rounded">
              <div className="flex items-center gap-1">
                <span>⚠️</span>
                <span>Riders can only be assigned when order is confirmed, preparing, ready, or out for delivery</span>
              </div>
            </div>
          )}
          
          {/* No riders available warning */}
          {riders?.length === 0 && !isLoadingRiders && (
            <div className="text-xs text-red-600 dark:text-red-400 bg-red-50 dark:bg-red-900/20 p-2 rounded">
              <div className="flex items-center gap-1 mb-1">
                <span>🚫</span>
                <span className="font-medium">No Active Dispatch Riders</span>
              </div>
              <div className="text-xs text-muted-foreground">
                To add dispatch riders: Go to Admin → Drivers Management
              </div>
            </div>
          )}
          
          {/* Reassignment notice */}
          {selectedStatus === 'out_for_delivery' && assignedRider && (
            <div className="text-xs text-blue-600 dark:text-blue-400 bg-blue-50 dark:bg-blue-900/20 p-2 rounded">
              <div className="flex items-center gap-1">
                <span>🔄</span>
                <span>This will reassign the rider for an order already out for delivery</span>
              </div>
            </div>
          )}
          
          {/* Production safety notice */}
          {riders && riders.length > 0 && (
            <div className="text-xs text-green-600 dark:text-green-400 bg-green-50 dark:bg-green-900/20 p-2 rounded">
              <div className="flex items-center gap-1">
                <span>✅</span>
                <span>{riders.length} active dispatch rider{riders.length !== 1 ? 's' : ''} available</span>
              </div>
            </div>
          )}
        </div>


        {/* Payment Verification */}
        <div className="space-y-2">
          <label className="text-xs font-medium text-muted-foreground">Payment Verification</label>
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