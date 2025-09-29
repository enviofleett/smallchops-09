import React from 'react';
import { formatAddressMultiline } from '@/utils/formatAddress';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { MapPin, Clock, FileText, AlertCircle, Navigation, Phone } from 'lucide-react';
import { OrderDetailsSectionErrorBoundary } from './ErrorBoundary';
import { FulfillmentSectionSkeleton } from './LoadingSkeleton';

interface CompleteFulfillmentSectionProps {
  order: any;
  fulfillmentInfo?: any;
  deliverySchedule?: any;
  pickupPoint?: any;
  isLoading?: boolean;
}

/**
 * Complete fulfillment section handling both delivery and pickup scenarios
 * Shows full address breakdown, time windows, and special instructions
 * Enhanced with error handling, loading states, and better formatting
 */
export const CompleteFulfillmentSection: React.FC<CompleteFulfillmentSectionProps> = ({ 
  order, 
  fulfillmentInfo,
  deliverySchedule,
  pickupPoint,
  isLoading = false
}) => {
  // Show loading skeleton if loading
  if (isLoading) {
    return <FulfillmentSectionSkeleton />;
  }

  // Error state if order is missing
  if (!order) {
    return (
      <OrderDetailsSectionErrorBoundary context="FulfillmentSection">
        <section className="space-y-3">
          <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
            <MapPin className="h-4 w-4" />
            Fulfillment Details
          </h3>
          <Alert>
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Fulfillment information is not available for this order.
            </AlertDescription>
          </Alert>
        </section>
      </OrderDetailsSectionErrorBoundary>
    );
  }

  const orderType = order?.order_type || 'delivery';
  const isDelivery = orderType === 'delivery';
  const isPickup = orderType === 'pickup';

  // Address handling with better validation
  const getFormattedAddress = () => {
    if (isDelivery) {
      if (order?.delivery_address) {
        try {
          const formatted = formatAddressMultiline(order.delivery_address);
          if (formatted && formatted.trim().length > 0) {
            return formatted;
          }
        } catch (error) {
          console.warn('Error formatting delivery address:', error);
        }
      }
      return 'Delivery address not available';
    } else if (isPickup && pickupPoint) {
      const parts = [];
      if (pickupPoint.address) parts.push(pickupPoint.address);
      if (pickupPoint.landmark) parts.push(`Near ${pickupPoint.landmark}`);
      if (pickupPoint.city) parts.push(pickupPoint.city);
      return parts.length > 0 ? parts.join('\n') : 'Pickup location to be confirmed';
    }
    return 'Address not available';
  };

  // Enhanced time window handling
  const getTimeWindow = () => {
    if (isDelivery && deliverySchedule) {
      const parts = [];
      
      // Date handling
      if (deliverySchedule.delivery_date) {
        try {
          const date = new Date(deliverySchedule.delivery_date);
          const today = new Date();
          const tomorrow = new Date(today);
          tomorrow.setDate(tomorrow.getDate() + 1);
          
          if (date.toDateString() === today.toDateString()) {
            parts.push('Today');
          } else if (date.toDateString() === tomorrow.toDateString()) {
            parts.push('Tomorrow');
          } else {
            parts.push(date.toLocaleDateString('en-NG', {
              weekday: 'long',
              year: 'numeric',
              month: 'long',
              day: 'numeric'
            }));
          }
        } catch {
          parts.push(deliverySchedule.delivery_date);
        }
      }
      
      // Time range
      if (deliverySchedule.delivery_time_start && deliverySchedule.delivery_time_end) {
        parts.push(`${deliverySchedule.delivery_time_start} - ${deliverySchedule.delivery_time_end}`);
      } else if (deliverySchedule.delivery_time_start) {
        parts.push(`From ${deliverySchedule.delivery_time_start}`);
      }
      
      // Flexibility indicator
      if (deliverySchedule.is_flexible) {
        parts.push('(Flexible timing)');
      }
      
      return parts.length > 0 ? parts.join(' ') : 'Time window not specified';
    } else if (isPickup && pickupPoint) {
      const parts = [];
      
      if (pickupPoint.pickup_date) {
        try {
          const date = new Date(pickupPoint.pickup_date);
          parts.push(date.toLocaleDateString('en-NG', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
          }));
        } catch {
          parts.push(pickupPoint.pickup_date);
        }
      }
      
      if (pickupPoint.pickup_time) {
        parts.push(pickupPoint.pickup_time);
      }
      
      return parts.length > 0 ? parts.join(' at ') : 'Pickup time to be confirmed';
    }
    
    return 'Time information not available';
  };

  // Get special instructions from multiple sources
  const getSpecialInstructions = () => {
    const instructions = [];
    
    if (deliverySchedule?.special_instructions) {
      instructions.push(deliverySchedule.special_instructions);
    }
    if (fulfillmentInfo?.special_instructions) {
      instructions.push(fulfillmentInfo.special_instructions);
    }
    if (order?.special_instructions) {
      instructions.push(order.special_instructions);
    }
    if (order?.delivery_notes) {
      instructions.push(order.delivery_notes);
    }
    
    return instructions.filter(Boolean);
  };

  // Get fulfillment status
  const getFulfillmentStatus = () => {
    const status = order?.status;
    
    if (!status) return null;
    
    const statusConfig = {
      'pending': { color: 'bg-yellow-100 text-yellow-800', label: 'Pending' },
      'confirmed': { color: 'bg-blue-100 text-blue-800', label: 'Confirmed' },
      'preparing': { color: 'bg-orange-100 text-orange-800', label: 'Preparing' },
      'ready': { color: 'bg-green-100 text-green-800', label: 'Ready' },
      'out_for_delivery': { color: 'bg-purple-100 text-purple-800', label: 'Out for Delivery' },
      'delivered': { color: 'bg-green-100 text-green-800', label: 'Delivered' },
      'cancelled': { color: 'bg-red-100 text-red-800', label: 'Cancelled' },
    };
    
    const config = statusConfig[status as keyof typeof statusConfig] || 
      { color: 'bg-gray-100 text-gray-800', label: status.replace(/_/g, ' ') };
    
    return (
      <Badge variant="secondary" className={config.color}>
        {config.label}
      </Badge>
    );
  };

  const specialInstructions = getSpecialInstructions();

  return (
    <OrderDetailsSectionErrorBoundary context="FulfillmentSection">
      <section className="space-y-3">
        <h3 className="font-semibold text-base text-foreground flex items-center gap-2">
          <MapPin className="h-4 w-4" />
          Fulfillment Details
          {getFulfillmentStatus()}
        </h3>
        
        <div className="space-y-4">
          {/* Address Section */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
              <MapPin className="h-3 w-3" />
              {isDelivery ? 'Delivery Address' : 'Pickup Location'}
            </h4>
            <div className="text-sm text-muted-foreground whitespace-pre-line">
              {getFormattedAddress()}
            </div>
            
            {/* Pickup point name and contact */}
            {isPickup && pickupPoint && (
              <div className="mt-2 space-y-1">
                {pickupPoint.name && (
                  <div className="text-sm font-medium text-foreground">
                    {pickupPoint.name}
                  </div>
                )}
                {pickupPoint.contact_phone && (
                  <div className="flex items-center gap-1 text-sm text-muted-foreground">
                    <Phone className="h-3 w-3" />
                    <a 
                      href={`tel:${pickupPoint.contact_phone}`}
                      className="hover:text-foreground"
                    >
                      {pickupPoint.contact_phone}
                    </a>
                  </div>
                )}
                {pickupPoint.hours && (
                  <div className="text-xs text-muted-foreground">
                    Hours: {pickupPoint.hours}
                  </div>
                )}
              </div>
            )}

            {/* Address validation warning */}
            {isDelivery && order?.delivery_address && 
             typeof order.delivery_address === 'object' && 
             (!order.delivery_address.street || !order.delivery_address.city) && (
              <Alert className="mt-2 border-yellow-200 bg-yellow-50">
                <AlertCircle className="h-4 w-4 text-yellow-600" />
                <AlertDescription className="text-yellow-800 text-xs">
                  Address may be incomplete. Please verify with customer.
                </AlertDescription>
              </Alert>
            )}
          </div>

          {/* Time Window Section */}
          <div className="bg-muted/50 rounded-lg p-4">
            <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
              <Clock className="h-3 w-3" />
              {isDelivery ? 'Delivery Window' : 'Pickup Time'}
            </h4>
            <div className="text-sm text-muted-foreground">
              {getTimeWindow()}
            </div>
            
            {/* Urgency indicator */}
            {deliverySchedule?.is_urgent && (
              <Badge variant="destructive" className="mt-2 text-xs">
                Urgent Delivery
              </Badge>
            )}
            
            {/* Estimated duration */}
            {fulfillmentInfo?.estimated_duration && (
              <div className="text-xs text-muted-foreground mt-1">
                Estimated Duration: {fulfillmentInfo.estimated_duration}
              </div>
            )}
          </div>

          {/* Special Instructions Section */}
          {specialInstructions.length > 0 && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium text-sm text-foreground mb-2 flex items-center gap-2">
                <FileText className="h-3 w-3" />
                Special Instructions
              </h4>
              <div className="space-y-2">
                {specialInstructions.map((instruction, index) => (
                  <div key={index} className="bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-800 rounded p-3">
                    <p className="text-sm text-amber-800 dark:text-amber-200">{instruction}</p>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Additional fulfillment info */}
          {fulfillmentInfo && (
            <div className="bg-muted/50 rounded-lg p-4">
              <h4 className="font-medium text-sm text-foreground mb-2">Additional Information</h4>
              <div className="space-y-1 text-sm text-muted-foreground">
                {fulfillmentInfo.estimated_prep_time && (
                  <div>Prep Time: {fulfillmentInfo.estimated_prep_time}</div>
                )}
                {fulfillmentInfo.packaging_requirements && (
                  <div>Packaging: {fulfillmentInfo.packaging_requirements}</div>
                )}
                {fulfillmentInfo.temperature_requirements && (
                  <div>Temperature: {fulfillmentInfo.temperature_requirements}</div>
                )}
              </div>
            </div>
          )}
        </div>
      </section>
    </OrderDetailsSectionErrorBoundary>
  );
};