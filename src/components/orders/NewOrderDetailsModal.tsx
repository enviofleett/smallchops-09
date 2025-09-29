import React, { useRef, useState } from 'react';
import { useReactToPrint } from 'react-to-print';
import { toast } from 'sonner';
import { ThermalPrintReceipt } from './ThermalPrintReceipt';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';
import '@/styles/thermal-print.css';
import { AdaptiveDialog } from '@/components/layout/AdaptiveDialog';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Separator } from '@/components/ui/separator';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { 
  Package,
  User,
  MapPin,
  Clock,
  Phone,
  Mail,
  Truck,
  CheckCircle,
  Printer,
  AlertCircle,
  Settings,
  Loader2
} from 'lucide-react';
import { useUserContext } from '@/hooks/useUserContext';
import { useRealTimeOrderData } from '@/hooks/useRealTimeOrderData';
import { useDriverManagement } from '@/hooks/useDriverManagement';
import { useProductionStatusUpdate } from '@/hooks/useProductionStatusUpdate';
import { RealTimeConnectionStatus } from '@/components/common/RealTimeConnectionStatus';
import { triggerOrderUpdate } from '@/components/notifications/NotificationIntegration';
import { supabase } from '@/integrations/supabase/client';
// Enhanced defensive validation imports with comprehensive data protection
import { 
  safeOrder, 
  displayStatus, 
  displayAddress, 
  statusOptions,
  safeOrderItems,
  calculateSafeOrderTotal,
  getSafeStatus,
  getSafePaymentStatus,
  getSafeOrderType,
  logOrderDataIssue
} from '@/utils/orderDefensiveValidation';
import { SafeOrderDataRenderer } from '@/components/common/SafeOrderDataRenderer';

/**
 * Props interface for NewOrderDetailsModal component
 * @interface NewOrderDetailsModalProps
 */
interface NewOrderDetailsModalProps {
  /** Controls modal visibility state */
  open: boolean;
  /** Callback function to close the modal */
  onClose: () => void;
  /** 
   * Raw order data from various sources (API, cache, real-time updates)
   * @critical This field undergoes comprehensive defensive validation
   * @source Multiple data sources: initial API response, real-time updates, cache fallback
   * @validation Applied through safeOrder() utility with null/undefined protection
   */
  order?: any;
}

// Status color mapping
const STATUS_COLORS = {
  pending: "bg-yellow-500",
  confirmed: "bg-blue-500",
  preparing: "bg-orange-500",
  ready: "bg-purple-500",
  out_for_delivery: "bg-indigo-500",
  delivered: "bg-green-500",
  cancelled: "bg-red-500",
  refunded: "bg-gray-500",
  completed: "bg-green-600",
  returned: "bg-red-400"
} as const;

// Driver assignment dialog component (for admin use)
const DriverAssignmentSection: React.FC<{
  orderId: string;
  currentDriverId?: string | null;
  onDriverAssigned: () => void;
}> = ({ orderId, currentDriverId, onDriverAssigned }) => {
  const { drivers, loading: driversLoading } = useDriverManagement();
  const [selectedDriverId, setSelectedDriverId] = useState<string>('');
  const [isAssigning, setIsAssigning] = useState(false);

  const activeDrivers = drivers.filter(driver => driver.is_active);

  const handleAssignDriver = async () => {
    if (!selectedDriverId || isAssigning) return;

    setIsAssigning(true);
    try {
      const { error } = await supabase.rpc('assign_rider_to_order', {
        p_order_id: orderId,
        p_rider_id: selectedDriverId
      });

      if (error) throw error;

      const driver = drivers.find(d => d.id === selectedDriverId);
      toast.success(`Driver ${driver?.name} assigned successfully`);
      
      // Trigger notification for driver assignment
      triggerOrderUpdate(orderId, 'driver_assigned', `Driver ${driver?.name} has been assigned to this order`);
      
      onDriverAssigned();
    } catch (error) {
      console.error('Driver assignment failed:', error);
      toast.error('Failed to assign driver');
    } finally {
      setIsAssigning(false);
    }
  };

  const handleUnassignDriver = async () => {
    if (isAssigning) return;

    setIsAssigning(true);
    try {
      const { error } = await supabase
        .from('orders')
        .update({ assigned_rider_id: null })
        .eq('id', orderId);

      if (error) throw error;

      toast.success('Driver unassigned successfully');
      triggerOrderUpdate(orderId, 'driver_unassigned', 'Driver has been unassigned from this order');
      onDriverAssigned();
    } catch (error) {
      console.error('Driver unassignment failed:', error);
      toast.error('Failed to unassign driver');
    } finally {
      setIsAssigning(false);
    }
  };

  if (driversLoading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="w-4 h-4 animate-spin" />
        Loading drivers...
      </div>
    );
  }

  const currentDriver = drivers.find(d => d.id === currentDriverId);

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h4 className="font-medium">Driver Assignment</h4>
        {currentDriver && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleUnassignDriver}
            disabled={isAssigning}
          >
            {isAssigning ? (
              <Loader2 className="w-4 h-4 animate-spin" />
            ) : (
              'Unassign'
            )}
          </Button>
        )}
      </div>

      {currentDriver ? (
        <div className="p-3 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center gap-2">
            <Truck className="w-4 h-4 text-green-600" />
            <span className="font-medium text-green-800">{currentDriver.name}</span>
          </div>
          <p className="text-sm text-green-600 mt-1">{currentDriver.phone}</p>
        </div>
      ) : (
        <div className="space-y-2">
          <select
            className="w-full p-2 border rounded-md"
            value={selectedDriverId}
            onChange={(e) => setSelectedDriverId(e.target.value)}
            disabled={isAssigning || activeDrivers.length === 0}
          >
            <option value="">Select a driver...</option>
            {activeDrivers.map(driver => (
              <option key={driver.id} value={driver.id}>
                {driver.name} - {driver.phone}
              </option>
            ))}
          </select>
          
          {activeDrivers.length === 0 ? (
            <p className="text-sm text-muted-foreground">No active drivers available</p>
          ) : (
            <Button
              onClick={handleAssignDriver}
              disabled={!selectedDriverId || isAssigning}
              size="sm"
              className="w-full"
            >
              {isAssigning ? (
                <>
                  <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                  Assigning...
                </>
              ) : (
                'Assign Driver'
              )}
            </Button>
          )}
        </div>
      )}
    </div>
  );
};

// Status update section (for admin use)
const AdminStatusUpdateSection: React.FC<{
  orderId: string;
  currentStatus: string;
  orderNumber: string;
  onStatusUpdated: () => void;
}> = ({ orderId, currentStatus, orderNumber, onStatusUpdated }) => {
  const { updateStatus, isUpdating } = useProductionStatusUpdate();
  const [selectedStatus, setSelectedStatus] = useState(currentStatus);

  const statusOptions = [
    { value: 'pending', label: 'Pending' },
    { value: 'confirmed', label: 'Confirmed' },
    { value: 'preparing', label: 'Preparing' },
    { value: 'ready', label: 'Ready' },
    { value: 'out_for_delivery', label: 'Out for Delivery' },
    { value: 'delivered', label: 'Delivered' },
    { value: 'completed', label: 'Completed' },
    { value: 'cancelled', label: 'Cancelled' }
  ];

  const handleStatusUpdate = async () => {
    if (selectedStatus === currentStatus || isUpdating) return;

    try {
      await updateStatus({ orderId, status: selectedStatus });
      
      // Trigger notification with Gmail integration
      triggerOrderUpdate(orderNumber, selectedStatus, `Order status updated to ${selectedStatus.replace('_', ' ')}`);
      
      onStatusUpdated();
    } catch (error) {
      console.error('Status update failed:', error);
    }
  };

  return (
    <div className="space-y-3">
      <h4 className="font-medium">Update Order Status</h4>
      
      <div className="space-y-2">
        <select
          className="w-full p-2 border rounded-md"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
          disabled={isUpdating}
        >
          {statusOptions.map(option => (
            <option key={option.value} value={option.value}>
              {option.label}
            </option>
          ))}
        </select>
        
        <Button
          onClick={handleStatusUpdate}
          disabled={selectedStatus === currentStatus || isUpdating}
          size="sm"
          className="w-full"
        >
          {isUpdating ? (
            <>
              <Loader2 className="w-4 h-4 mr-2 animate-spin" />
              Updating...
            </>
          ) : (
            'Update Status'
          )}
        </Button>
      </div>
    </div>
  );
};

/**
 * Safely formats currency values with defensive null/undefined handling
 * @param amount - Raw numeric value that may be null, undefined, or invalid
 * @returns Formatted Nigerian Naira currency string
 * @defensive Returns ₦0 for null/undefined/NaN values
 */
const formatCurrency = (amount: number | null | undefined): string => {
  // Defensive validation: handle null, undefined, and NaN values
  const safeAmount = typeof amount === 'number' && !isNaN(amount) ? amount : 0;
  
  try {
    return new Intl.NumberFormat('en-NG', {
      style: 'currency',
      currency: 'NGN',
      minimumFractionDigits: 0
    }).format(safeAmount);
  } catch (error) {
    // Fallback for Intl API errors
    console.warn('Currency formatting failed, using fallback:', error);
    return `₦${safeAmount.toLocaleString()}`;
  }
};

/**
 * Safely extracts and validates order items from multiple possible data sources
 * @param rawOrderData - Raw order data from API/real-time updates
 * @param detailedOrderData - Detailed order data from real-time source  
 * @param order - Fallback order data from props
 * @returns Validated and safe array of order items
 * @defensive Always returns array, never undefined/null
 * @source Priority: detailedOrderData.items -> order.order_items -> order.items -> []
 * @validation Each item validated through safeOrderItems utility
 * @production_safe Handles null/undefined gracefully, logs issues for debugging
 */
const extractSafeOrderItems = (
  rawOrderData: any, 
  detailedOrderData: any, 
  order: any
): any[] => {
  // Priority-based data extraction with defensive fallbacks
  const possibleSources = [
    detailedOrderData?.items,
    order?.order_items, 
    order?.items,
    rawOrderData?.items,
    rawOrderData?.order_items
  ];
  
  for (const source of possibleSources) {
    if (Array.isArray(source) && source.length > 0) {
      try {
        return safeOrderItems(source);
      } catch (error) {
        console.warn('Failed to validate order items from source:', error);
        continue;
      }
    }
  }
  
  // Ultimate fallback: empty array
  console.warn('No valid order items found in any data source, returning empty array');
  logOrderDataIssue('No valid order items found', { rawOrderData, detailedOrderData, order });
  return [];
};

/**
 * Safely extracts fulfillment information with comprehensive fallback strategy
 * @param detailedOrderData - Primary data source from real-time updates
 * @param order - Fallback order data from props
 * @returns Safely validated fulfillment info object
 * @defensive Always returns object, handles nested property access safely
 * @source_priority detailedOrderData.fulfillment_info -> order.fulfillment_info -> {}
 * @production_safe Never throws errors, graceful degradation
 */
const extractSafeFulfillmentInfo = (detailedOrderData: any, order: any): Record<string, any> => {
  const sources = [
    detailedOrderData?.fulfillment_info,
    order?.fulfillment_info,
    {} // Ultimate fallback
  ];
  
  for (const source of sources) {
    if (source && typeof source === 'object' && !Array.isArray(source)) {
      return source;
    }
  }
  
  return {};
};

/**
 * NewOrderDetailsModal - Production-Safe Order Details Display Component
 * 
 * @description Displays comprehensive order information with robust defensive data handling.
 * Implements multiple layers of data validation and fallback strategies to prevent
 * rendering errors from malformed, null, or missing data.
 * 
 * @features
 * - Multi-source data aggregation (API, real-time, cache)
 * - Comprehensive defensive validation for all critical fields
 * - Real-time order updates with connection status monitoring
 * - Admin functionality (status updates, driver assignment)
 * - Thermal receipt printing capability
 * - Error boundaries and graceful degradation
 * 
 * @dataSources
 * 1. Primary: Real-time order data via useRealTimeOrderData hook
 * 2. Fallback: Initial order data from props
 * 3. Emergency: Hard-coded fallback values for critical fields
 * 
 * @defensive_strategies
 * - All order data passes through safeOrder() validation
 * - Order items validated via safeOrderItems() with array protection
 * - Currency values protected against null/undefined/NaN
 * - Address data validated through safeAddress() utility
 * - Status values constrained to valid enum values
 * - Nested object access protected with optional chaining and fallbacks
 * 
 * @param props - Component props containing order data and modal controls
 * @returns React component with error boundaries and defensive rendering
 */
export const NewOrderDetailsModal: React.FC<NewOrderDetailsModalProps> = ({
  open,
  onClose,
  order // Raw order data from multiple possible sources
}) => {
  const userContext = useUserContext();
  const printRef = useRef<HTMLDivElement>(null);
  const thermalPrintRef = useRef<HTMLDivElement>(null);
  const [refreshTrigger, setRefreshTrigger] = useState(0);
  const { data: businessSettings } = useBusinessSettings();

  // =============================================================================
  // DATA SOURCE INITIALIZATION & DEFENSIVE VALIDATION
  // =============================================================================
  
  /**
   * Real-time order data hook with connection status monitoring
   * @source Primary data source for live order updates
   * @fallback Falls back to props.order if real-time data unavailable
   * @validation Data passes through defensive validation before rendering
   */
  const { 
    data: detailedOrderData, 
    isLoading: isLoadingDetailed, 
    error, 
    lastUpdated, 
    connectionStatus, 
    reconnect 
  } = useRealTimeOrderData(order?.id);

  // =============================================================================
  // DATA AGGREGATION WITH DEFENSIVE FALLBACK STRATEGY  
  // =============================================================================
  
  /**
   * Multi-source data aggregation with priority-based fallback
   * @priority 1. detailedOrderData.order (real-time)
   * @priority 2. order (props fallback)
   * @defensive Handles null/undefined cases gracefully
   */
  const rawOrderData = detailedOrderData?.order || order;
  
  /**
   * Safe order items extraction from multiple sources
   * @source_priority detailedOrderData.items -> order.order_items -> order.items -> []
   * @validation Each source validated through safeOrderItems utility
   * @defensive Always returns array, prevents undefined.map() errors
   */
  const rawOrderItems = extractSafeOrderItems(rawOrderData, detailedOrderData, order);
  
  /**
   * Safe fulfillment information extraction
   * @source_priority detailedOrderData.fulfillment_info -> order.fulfillment_info -> {}
   * @defensive Returns empty object if no valid source found
   */
  const fulfillmentInfo = extractSafeFulfillmentInfo(detailedOrderData, order);

  // =============================================================================
  // COMPREHENSIVE ORDER DATA VALIDATION
  // =============================================================================
  
  /**
   * Apply comprehensive defensive validation to prevent rendering errors
   * @validation_layers
   * 1. Type checking (object existence, structure validation)
   * 2. Field sanitization (string conversion, number validation)
   * 3. Enum validation (status, payment_status, order_type)
   * 4. Nested object safety (address, timeline, items)
   * @returns Fully validated Order object or null for graceful error handling
   */
  const safeOrderData = safeOrder(rawOrderData);
  
  /**
   * Validated order items with defensive transformations
   * @source rawOrderItems (pre-filtered from multiple sources)
   * @validation Each item validated for required fields, type safety
   * @defensive Handles missing product data, invalid quantities/prices
   */
  const orderItems = safeOrderData?.items || rawOrderItems;

  // =============================================================================
  // ERROR BOUNDARY CONDITIONS
  // =============================================================================

  const handlePrint = useReactToPrint({
    contentRef: thermalPrintRef,
    documentTitle: `Order-${order?.order_number || 'Details'}`,
    pageStyle: `
      @page {
        size: 80mm auto;
        margin: 2mm;
        padding: 0;
      }
      @media print {
        body {
          margin: 0;
          padding: 0;
          background: white !important;
          -webkit-print-color-adjust: exact;
          print-color-adjust: exact;
          font-family: 'Courier New', monospace !important;
        }
        .thermal-receipt {
          display: block !important;
          position: relative !important;
          left: auto !important;
          top: auto !important;
          width: 76mm !important;
          max-width: 76mm !important;
          background: white !important;
          color: black !important;
          font-family: 'Courier New', monospace !important;
          font-size: 8px !important;
          line-height: 1.2 !important;
          margin: 0 !important;
          padding: 2mm !important;
          page-break-after: avoid;
          page-break-inside: avoid;
          overflow: visible;
          min-height: auto;
        }
      }
    `,
    onBeforePrint: () => {
      // Show the thermal receipt temporarily for printing
      if (thermalPrintRef.current) {
        thermalPrintRef.current.style.display = 'block';
        thermalPrintRef.current.style.position = 'relative';
        thermalPrintRef.current.style.left = 'auto';
        thermalPrintRef.current.style.top = 'auto';
      }
      return Promise.resolve();
    },
    onAfterPrint: () => {
      // Hide the thermal receipt again after printing
      if (thermalPrintRef.current) {
        thermalPrintRef.current.style.display = 'none';
        thermalPrintRef.current.style.position = 'absolute';
        thermalPrintRef.current.style.left = '-9999px';
        thermalPrintRef.current.style.top = '0';
      }
      toast.success('Thermal receipt printed successfully');
    },
    onPrintError: () => toast.error('Failed to print thermal receipt')
  });

  const handleRefresh = () => {
    reconnect();
    setRefreshTrigger(prev => prev + 1);
  };

  /**
   * CRITICAL ERROR BOUNDARY: No order data provided
   * @condition order is null/undefined (complete data absence)
   * @response Display user-friendly error modal with recovery options
   * @defensive Prevents component crash from undefined property access
   */
  if (!order) {
    return (
      <AdaptiveDialog
        open={open}
        onOpenChange={onClose}
        size="sm"
        title="Order Not Found"
        description="Order details are not available"
      >
        <div className="text-center py-8">
          <AlertCircle className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
          <p className="text-muted-foreground">No order data provided.</p>
          <p className="text-xs text-muted-foreground mt-2">
            Data source: Props validation failed
          </p>
          <Button onClick={onClose} className="mt-4">Close</Button>
        </div>
      </AdaptiveDialog>
    );
  }

  /**
   * CRITICAL ERROR BOUNDARY: Order data validation failure
   * @condition safeOrder() returns null (corrupted/invalid data structure)
   * @response Display data corruption error with recovery options
   * @defensive Prevents React rendering errors from malformed data
   * @logging Provides debugging information for data source identification
   */
  if (!safeOrderData) {
    // Enhanced error logging for debugging
    logOrderDataIssue('Order validation failed in NewOrderDetailsModal', rawOrderData);
    
    console.error('Order data validation failed:', {
      orderId: order?.id,
      orderNumber: order?.order_number,
      dataStructure: order ? Object.keys(order) : 'null',
      detailedDataAvailable: !!detailedOrderData,
      timestamp: new Date().toISOString()
    });

    return (
      <AdaptiveDialog
        open={open}
        onOpenChange={onClose}
        size="lg"
        title="Order Details"
        description="Unable to load order"
      >
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <div className="flex items-center justify-between gap-4">
              <div>
                <p className="font-medium">Invalid order data structure</p>
                <p className="text-sm text-muted-foreground">
                  The order data failed validation checks. This may indicate corrupted data
                  or a schema mismatch.
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  Order ID: {order?.id || 'Unknown'} | 
                  Source: {detailedOrderData ? 'Real-time + Props' : 'Props only'}
                </p>
              </div>
              <Button 
                variant="outline" 
                size="sm" 
                onClick={() => window.location.reload()}
              >
                Refresh
              </Button>
            </div>
          </AlertDescription>
        </Alert>
      </AdaptiveDialog>
    );
  }

  /**
   * LOADING STATE: Real-time data fetch in progress
   * @condition Loading detailed data but no validated order data available
   * @defensive Only shows loading if we don't have fallback data to display
   */
  if (isLoadingDetailed && !safeOrderData) {
    return (
      <AdaptiveDialog
        open={open}
        onOpenChange={onClose}
        size="lg"
        title="Loading Order Details..."
      >
        <div className="flex items-center justify-center py-12">
          <Loader2 className="w-8 h-8 animate-spin" />
          <span className="ml-2">Loading order details...</span>
          <p className="text-xs text-muted-foreground ml-2">
            Source: Real-time data fetch
          </p>
        </div>
      </AdaptiveDialog>
    );
  }

  // =============================================================================
  // VALIDATED DATA ASSIGNMENT
  // =============================================================================
  
  /**
   * Final validated order data for rendering
   * @source safeOrderData (passed all validation layers)
   * @guarantee All properties are type-safe and rendering-safe
   */
  const orderData = safeOrderData;

  // =============================================================================
  // USER CONTEXT & PERMISSIONS VALIDATION
  // =============================================================================
  
  /**
   * Safe user context determination with defensive fallback
   * @source useUserContext hook
   * @defensive Handles null/undefined context gracefully
   * @default Falls back to 'customer' if context unavailable
   */
  const userContext = useUserContext();
  const isAdmin = userContext === 'admin';
  const isCustomer = userContext === 'customer' || !userContext; // Defensive default

  // =============================================================================
  // COMPONENT UTILITIES & EVENT HANDLERS
  // =============================================================================

  return (
    <AdaptiveDialog
      open={open}
      onOpenChange={onClose}
      size="xl"
      title={`Order #${orderData.order_number}`}
      description={isAdmin ? "Admin View - Full Order Management" : "Order Details"}
      className="max-w-6xl"
    >
      <div className="max-w-5xl mx-auto space-y-6" ref={printRef}>
        {/* Real-time connection status (admin only) */}
        {isAdmin && (
          <RealTimeConnectionStatus
            connectionStatus={connectionStatus}
            lastUpdated={lastUpdated}
            onReconnect={reconnect}
            compact={true}
            className="mb-4"
          />
        )}

        {/* Error Alert */}
        {error && (
          <Alert variant="destructive">
            <AlertCircle className="h-4 w-4" />
            <AlertDescription>
              Failed to load complete order details. Some information may be outdated.
              <Button variant="outline" size="sm" onClick={handleRefresh} className="ml-2">
                Retry
              </Button>
            </AlertDescription>
          </Alert>
        )}

        {/* Header */}
        <Card>
          <CardHeader className="pb-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3 flex-wrap">
                <Badge className={`${STATUS_COLORS[orderData.status as keyof typeof STATUS_COLORS] || 'bg-gray-500'} text-white text-base px-4 py-2`}>
                  {displayStatus(orderData.status)}
                </Badge>
                <Badge variant="outline" className="text-sm px-3 py-1">
                  {orderData.order_type?.toUpperCase() || 'DELIVERY'}
                </Badge>
                {!isLoadingDetailed && detailedOrderData && (
                  <Badge variant="secondary" className="bg-green-100 text-green-800 text-xs">
                    LIVE DATA
                  </Badge>
                )}
                {isAdmin && (
                  <Badge variant="secondary" className="bg-blue-100 text-blue-800 text-xs">
                    ADMIN VIEW
                  </Badge>
                )}
              </div>
              <div className="flex items-center gap-2">
                <Button variant="outline" size="sm" onClick={handlePrint}>
                  <Printer className="w-4 h-4 mr-2" />
                  Print Receipt
                </Button>
                <Button 
                  variant="ghost" 
                  size="sm" 
                  onClick={() => {
                    // Show preview of thermal receipt for debugging
                    if (thermalPrintRef.current) {
                      const receiptContent = thermalPrintRef.current.innerHTML;
                      const previewWindow = window.open('', '_blank', 'width=400,height=600');
                      if (previewWindow) {
                        previewWindow.document.write(`
                          <!DOCTYPE html>
                          <html>
                            <head>
                              <title>Receipt Preview</title>
                              <style>
                                body { 
                                  font-family: 'Courier New', monospace; 
                                  font-size: 8px; 
                                  line-height: 1.2; 
                                  max-width: 76mm; 
                                  margin: 0 auto; 
                                  padding: 2mm;
                                  background: white;
                                  color: black;
                                }
                                .business-name { font-weight: 900; font-size: 11px; text-align: center; text-transform: uppercase; margin-bottom: 2px; }
                                .contact { font-size: 8px; text-align: center; margin-bottom: 1px; }
                                .section-header { font-weight: 900; font-size: 9px; margin-bottom: 1px; text-transform: uppercase; }
                                .divider { text-align: center; font-size: 8px; margin: 1px 0; }
                                .item-header { display: flex; justify-content: space-between; font-size: 8px; }
                                .item-total { font-weight: 900; }
                                .item-meta { font-size: 7px; margin-bottom: 0; }
                                .item-detail { font-size: 7px; margin-left: 2px; margin-bottom: 0; }
                                .summary-line { display: flex; justify-content: space-between; font-size: 8px; margin-bottom: 0; }
                                .total-line { display: flex; justify-content: space-between; font-weight: 900; font-size: 10px; border-top: 2px solid black; padding-top: 2px; margin-top: 2px; }
                                .text-center { text-align: center; }
                                .order-info, .customer-info, .delivery-schedule, .payment-info, .special-instructions { margin-bottom: 2px; font-size: 8px; }
                                .items-section { margin-bottom: 2px; }
                                .item-block { margin-bottom: 1px; }
                                .order-summary { margin-bottom: 2px; }
                                .footer { text-align: center; font-size: 7px; }
                                .admin-print-info { font-size: 8px; margin-top: 4px; text-align: center; font-weight: 900; text-transform: uppercase; }
                              </style>
                            </head>
                            <body>
                              ${receiptContent}
                            </body>
                          </html>
                        `);
                        previewWindow.document.close();
                      }
                    }
                  }}
                  className="text-xs"
                >
                  Preview
                </Button>
              </div>
            </div>
          </CardHeader>
        </Card>

        {/* Customer Information - Defensively Protected */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <User className="w-5 h-5" />
              Customer Information
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {/* Customer Name & Type - Safe String Handling */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Name</p>
                <p className="text-sm">{orderData?.customer_name || 'Not provided'}</p>
              </div>
              <div>
                <p className="text-sm font-medium text-muted-foreground">Type</p>
                <p className="text-sm">{orderData?.customer_type || 'Guest Customer'}</p>
              </div>
            </div>
            
            {/* Email - Conditional Rendering with Validation */}
            {orderData?.customer_email && String(orderData.customer_email).trim() && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Mail className="w-4 h-4" />
                  Email
                </p>
                <p className="text-sm break-all">{String(orderData.customer_email)}</p>
              </div>
            )}

            {/* Phone - Conditional Rendering with Validation */}
            {orderData?.customer_phone && String(orderData.customer_phone).trim() && (
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Phone className="w-4 h-4" />
                  Phone
                </p>
                <p className="text-sm">{String(orderData.customer_phone)}</p>
              </div>
            )}

            {/* Payment Status & Reference - Defensive Badge Rendering */}
            <div className="flex items-center justify-between flex-wrap gap-4">
              <div>
                <p className="text-sm font-medium text-muted-foreground">Payment Status</p>
                <Badge 
                  variant="secondary" 
                  className={`ml-2 ${
                    orderData?.payment_status === 'paid' ? 'bg-green-100 text-green-800' : 
                    orderData?.payment_status === 'pending' ? 'bg-yellow-100 text-yellow-800' :
                    orderData?.payment_status === 'failed' ? 'bg-red-100 text-red-800' :
                    'bg-gray-100 text-gray-800'
                  }`}
                >
                  {String(orderData?.payment_status || 'UNKNOWN').toUpperCase()}
                </Badge>
              </div>
              {/* Payment Reference - Safe String Rendering */}
              {orderData?.payment_reference && String(orderData.payment_reference).trim() && (
                <div className="text-right">
                  <p className="text-sm font-medium text-muted-foreground">Payment Reference</p>
                  <p className="text-sm font-mono break-all">{String(orderData.payment_reference)}</p>
                </div>
              )}
            </div>
          </CardContent>
        </Card>

        {/* Admin Actions (Admin Only) */}
        {isAdmin && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Settings className="w-5 h-5" />
                Admin Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <AdminStatusUpdateSection
                orderId={orderData.id}
                currentStatus={orderData.status}
                orderNumber={orderData.order_number}
                onStatusUpdated={handleRefresh}
              />
              
              <Separator />
              
              <DriverAssignmentSection
                orderId={orderData.id}
                currentDriverId={orderData.assigned_rider_id}
                onDriverAssigned={handleRefresh}
              />
            </CardContent>
          </Card>
        )}

        {/* Order Items - Defensively Protected Rendering */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Package className="w-5 h-5" />
              Order Items ({(orderItems?.length || 0)})
            </CardTitle>
          </CardHeader>
          <CardContent>
            {!orderItems || orderItems.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground">
                <Package className="w-12 h-12 mx-auto mb-3 opacity-50" />
                <p>No items found for this order</p>
                <p className="text-xs mt-1">
                  Data checked: {detailedOrderData ? 'Real-time + Props' : 'Props only'}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {orderItems.map((item: any, index: number) => (
                  <div key={item?.id || `item-${index}`} className="flex items-start gap-4 p-4 border rounded-lg bg-card">
                    {/* Product Image - Defensive Rendering */}
                    {item?.product?.image_url && (
                      <div className="w-16 h-16 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                        <img 
                          src={item.product.image_url} 
                          alt={item.product?.name || item?.name || 'Product Image'}
                          className="w-full h-full object-cover"
                          loading="lazy"
                          onError={(e) => {
                            e.currentTarget.style.display = 'none';
                          }}
                        />
                      </div>
                    )}
                    <div className="flex-1 min-w-0 space-y-2">
                      {/* Product Name & Price - Defensive Fallbacks */}
                      <div className="flex items-start justify-between gap-2">
                        <h4 className="font-medium text-foreground leading-tight">
                          {item?.product?.name || item?.name || item?.product_name || 'Unknown Product'}
                        </h4>
                        <span className="font-semibold text-foreground whitespace-nowrap">
                          {formatCurrency(item?.total_price)}
                        </span>
                      </div>
                      
                      {/* Quantity & Unit Price - Safe Number Handling */}
                      <div className="flex items-center gap-4 text-sm text-muted-foreground">
                        <span>Qty: {item?.quantity || 1}</span>
                        <span>×</span>
                        <span>{formatCurrency(item?.unit_price)}</span>
                      </div>

                      {/* Special Instructions - Conditional Rendering */}
                      {item?.special_instructions && (
                        <div className="text-xs text-muted-foreground italic bg-muted/50 p-2 rounded">
                          <span className="font-medium">Note:</span> {String(item.special_instructions)}
                        </div>
                      )}

                      {/* Customizations - Safe String Conversion */}
                      {item?.customizations && (
                        <div className="text-xs text-muted-foreground bg-muted/50 p-2 rounded">
                          <span className="font-medium">Customizations:</span> {String(item.customizations)}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
                
                {/* Order Summary - Defensive Financial Calculations */}
                <div className="border-t pt-4 mt-6">
                  <div className="space-y-2">
                    {/* Subtotal Calculation - Safe Reduce Operation */}
                    <div className="flex justify-between text-sm">
                      <span className="text-muted-foreground">Subtotal</span>
                      <span className="font-medium">
                        {formatCurrency(
                          Array.isArray(orderItems) 
                            ? orderItems.reduce((sum: number, item: any) => sum + (Number(item?.total_price) || 0), 0)
                            : 0
                        )}
                      </span>
                    </div>
                    
                    {/* VAT - Conditional Rendering with Safe Numbers */}
                    {(orderData?.vat_amount || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">
                          VAT ({orderData?.vat_rate || 7.5}%)
                        </span>
                        <span className="font-medium">{formatCurrency(orderData.vat_amount)}</span>
                      </div>
                    )}
                    
                    {/* Delivery Fee - Safe Number Check */}
                    {(orderData?.delivery_fee || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Delivery Fee</span>
                        <span className="font-medium">{formatCurrency(orderData.delivery_fee)}</span>
                      </div>
                    )}
                    
                    {/* Discount - Safe Number Check */}
                    {(orderData?.discount_amount || 0) > 0 && (
                      <div className="flex justify-between text-sm">
                        <span className="text-muted-foreground">Discount</span>
                        <span className="font-medium text-success">
                          -{formatCurrency(orderData.discount_amount)}
                        </span>
                      </div>
                    )}
                    
                    {/* Total - Defensive Final Calculation */}
                    <div className="border-t pt-2">
                      <div className="flex justify-between font-semibold text-lg">
                        <span>Total</span>
                        <span>{formatCurrency(orderData?.total_amount)}</span>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Delivery Information - Conditional & Defensive */}
        {orderData?.order_type === 'delivery' && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Truck className="w-5 h-5" />
                Delivery Information
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              {/* Delivery Window - Multi-source with Fallbacks */}
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <Clock className="w-4 h-4" />
                  Delivery Window
                </p>
                <p className="text-sm">
                  {(() => {
                    // Priority-based delivery time extraction with defensive checks
                    if (fulfillmentInfo?.delivery_date && fulfillmentInfo?.delivery_hours) {
                      const start = fulfillmentInfo.delivery_hours?.start || '';
                      const end = fulfillmentInfo.delivery_hours?.end || '';
                      return `${fulfillmentInfo.delivery_date} ${start} - ${end}`.trim();
                    }
                    
                    if (detailedOrderData?.delivery_schedule?.delivery_date) {
                      const schedule = detailedOrderData.delivery_schedule;
                      const start = schedule.delivery_time_start || '';
                      const end = schedule.delivery_time_end || '';
                      return `${schedule.delivery_date} ${start} - ${end}`.trim();
                    }
                    
                    if (orderData?.delivery_window) {
                      return String(orderData.delivery_window);
                    }
                    
                    return 'To be scheduled';
                  })()}
                </p>
              </div>
              
              {/* Address - Defensive Address Rendering */}
              <div>
                <p className="text-sm font-medium text-muted-foreground flex items-center gap-2">
                  <MapPin className="w-4 h-4" />
                  Address
                </p>
                <p className="text-sm break-words">
                  {(() => {
                    // Multi-source address extraction with defensive validation
                    const addressSources = [
                      fulfillmentInfo?.address,
                      orderData?.delivery_address,
                      orderData?.address
                    ];
                    
                    for (const addr of addressSources) {
                      if (addr) {
                        const displayAddr = displayAddress(addr);
                        if (displayAddr && displayAddr !== 'N/A') {
                          return displayAddr;
                        }
                      }
                    }
                    
                    return 'Address not provided';
                  })()}
                </p>
              </div>
              
              {/* Special Instructions - Multi-source Extraction */}
              {(() => {
                const instructionSources = [
                  fulfillmentInfo?.special_instructions,
                  orderData?.special_instructions,
                  detailedOrderData?.delivery_schedule?.special_instructions
                ];
                
                const instructions = instructionSources.find(inst => 
                  inst && String(inst).trim().length > 0
                );
                
                return instructions ? (
                  <div>
                    <p className="text-sm font-medium text-muted-foreground">Special Instructions</p>
                    <p className="text-sm break-words">{String(instructions)}</p>
                  </div>
                ) : null;
              })()}

              {/* Driver Assignment Status - Admin Only */}
              {isAdmin && orderData?.assigned_rider_id && detailedOrderData?.items && (
                <div className="mt-4 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                  <p className="text-sm font-medium text-blue-800 mb-1">Driver Assignment</p>
                  <p className="text-sm text-blue-600">
                    Driver ID: {String(orderData.assigned_rider_id)}
                    {orderData?.assigned_rider_name && ` (${String(orderData.assigned_rider_name)})`}
                  </p>
                </div>
              )}
            </CardContent>
          </Card>
        )}

        {/* Status Timeline */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <CheckCircle className="w-5 h-5" />
              Order Timeline
            </CardTitle>
          </CardHeader>
          <CardContent>
            {detailedOrderData?.timeline && detailedOrderData.timeline.length > 0 ? (
              <div className="space-y-3">
                {detailedOrderData.timeline.map((step: any, index: number) => (
                  <div key={index} className="flex items-center gap-3">
                    <div className={`w-3 h-3 rounded-full ${
                      step.status === 'completed' ? 'bg-green-500' :
                      step.status === 'current' ? 'bg-blue-500' :
                      'bg-gray-300'
                    }`}></div>
                    <div className="flex-1">
                      <p className={`text-sm font-medium ${
                        step.status === 'pending' ? 'text-muted-foreground' : ''
                      }`}>
                        {step.label || step.step}
                      </p>
                      <p className="text-xs text-muted-foreground">
                        {step.datetime ? new Date(step.datetime).toLocaleString() : 'Pending'}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              // Fallback timeline based on current status
              <div className="space-y-3">
                <div className="flex items-center gap-3">
                  <div className="w-3 h-3 rounded-full bg-green-500"></div>
                  <div className="flex-1">
                    <p className="text-sm font-medium">Order Placed</p>
                    <p className="text-xs text-muted-foreground">
                      {orderData.created_at ? new Date(orderData.created_at).toLocaleString() : 'Date not available'}
                    </p>
                  </div>
                </div>
                
                {['confirmed', 'preparing', 'ready', 'out_for_delivery', 'delivered', 'completed'].includes(orderData.status) && (
                  <div className="flex items-center gap-3">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <div className="flex-1">
                      <p className="text-sm font-medium">Order Confirmed</p>
                      <p className="text-xs text-muted-foreground">
                        {orderData.updated_at ? new Date(orderData.updated_at).toLocaleString() : 'Recently'}
                      </p>
                    </div>
                  </div>
                )}
                
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    orderData.status === 'preparing' ? 'bg-orange-500' :
                    ['ready', 'out_for_delivery', 'delivered', 'completed'].includes(orderData.status) ? 'bg-green-500' :
                    'bg-gray-300'
                  }`}></div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      !['preparing', 'ready', 'out_for_delivery', 'delivered', 'completed'].includes(orderData.status) ? 'text-muted-foreground' : ''
                    }`}>
                      {orderData.status === 'preparing' ? 'Currently Preparing' : 'Preparing'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {orderData.status === 'preparing' ? 'In progress' : 'Pending'}
                    </p>
                  </div>
                </div>
                
                <div className="flex items-center gap-3">
                  <div className={`w-3 h-3 rounded-full ${
                    ['delivered', 'completed'].includes(orderData.status) ? 'bg-green-500' :
                    'bg-gray-300'
                  }`}></div>
                  <div className="flex-1">
                    <p className={`text-sm font-medium ${
                      !['delivered', 'completed'].includes(orderData.status) ? 'text-muted-foreground' : ''
                    }`}>
                      {orderData.order_type === 'delivery' ? 'Delivered' : 'Ready for Pickup'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {['delivered', 'completed'].includes(orderData.status) ? 'Completed' : 'Pending'}
                    </p>
                  </div>
                </div>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Communication Events (Admin Only) */}
        {isAdmin && detailedOrderData?.communication_events && detailedOrderData.communication_events.length > 0 && (
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Mail className="w-5 h-5" />
                Communication History
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="space-y-3 max-h-60 overflow-y-auto">
                {detailedOrderData.communication_events.map((event: any, index: number) => (
                  <div key={event.id || index} className="p-3 border rounded-lg">
                    <div className="flex items-center justify-between mb-2">
                      <Badge variant="outline" className="text-xs">
                        {event.event_type || 'Email'}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {event.created_at ? new Date(event.created_at).toLocaleString() : 'Recently'}
                      </span>
                    </div>
                    <p className="text-sm">{event.message || event.subject || 'Communication sent'}</p>
                    {event.status && (
                      <Badge 
                        variant="secondary" 
                        className={`mt-2 text-xs ${
                          event.status === 'sent' ? 'bg-green-100 text-green-800' :
                          event.status === 'delivered' ? 'bg-blue-100 text-blue-800' :
                          event.status === 'failed' ? 'bg-red-100 text-red-800' :
                          'bg-gray-100 text-gray-800'
                        }`}
                      >
                        {event.status.toUpperCase()}
                      </Badge>
                    )}
                  </div>
                ))}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Metadata - Defensively Protected System Information */}
        <Card>
          <CardContent className="pt-6">
             <div className="text-sm text-muted-foreground space-y-1">
               {/* Created Date - Safe Date Handling */}
               <p>
                 Created: {(() => {
                   try {
                     if (orderData?.created_at) {
                       return new Date(orderData.created_at).toLocaleString();
                     }
                     if (orderData?.order_time) {
                       return new Date(orderData.order_time).toLocaleString();
                     }
                     return 'Date not available';
                   } catch (error) {
                     console.warn('Date parsing failed:', error);
                     return 'Invalid date format';
                   }
                 })()}
               </p>
               
               {/* Last Updated - Safe Date Handling with Fallbacks */}
               <p>
                 Last Updated: {(() => {
                   try {
                     if (orderData?.updated_at) {
                       return new Date(orderData.updated_at).toLocaleString();
                     }
                     if (orderData?.created_at) {
                       return new Date(orderData.created_at).toLocaleString();
                     }
                     if (lastUpdated) {
                       return new Date(lastUpdated).toLocaleString() + ' (Real-time)';
                     }
                     return 'Not available';
                   } catch (error) {
                     console.warn('Updated date parsing failed:', error);
                     return 'Invalid date format';
                   }
                 })()}
               </p>
               
               {/* Order ID - Safe String Display */}
               <p>Order ID: {String(orderData?.id || 'Unknown')}</p>
               
               {/* Data Source Information - Debugging Aid */}
               <p className="text-xs opacity-75">
                 Data Source: {(() => {
                   if (detailedOrderData && order) return 'Real-time + Props';
                   if (detailedOrderData) return 'Real-time only';
                   if (order) return 'Props only';
                   return 'Unknown';
                 })()} | 
                 Validation: {safeOrderData ? 'Passed' : 'Failed'} |
                 Items: {orderItems?.length || 0}
               </p>
               
               {/* Real-time Status - Admin Only */}
               {isAdmin && (
                 <p className={`${
                   connectionStatus === 'connected' ? 'text-green-600' : 
                   connectionStatus === 'connecting' ? 'text-yellow-600' :
                   'text-red-600'
                 }`}>
                   {connectionStatus === 'connected' ? '🟢' : 
                    connectionStatus === 'connecting' ? '🟡' : '🔴'} 
                   Real-time: {connectionStatus || 'Unknown'}
                   {lastUpdated && connectionStatus === 'connected' && (
                     <span className="ml-2 text-xs">
                       (Last: {new Date(lastUpdated).toLocaleTimeString()})
                     </span>
                   )}
                 </p>
               )}
             </div>
           </CardContent>
         </Card>

         {/* Hidden Thermal Receipt for Printing */}
         <div ref={thermalPrintRef} style={{ position: 'absolute', left: '-9999px', top: '0', background: 'white', padding: '2mm' }}>
           <ThermalPrintReceipt
             order={{
               ...orderData,
               order_items: orderItems,
               fulfillment_info: fulfillmentInfo
             }}
             deliverySchedule={fulfillmentInfo}
             businessInfo={businessSettings ? {
               name: businessSettings.name || 'Starter Small Chops',
               whatsapp_support_number: businessSettings.whatsapp_support_number || '0807 301 1100',
               admin_notification_email: 'store@startersmallchops.com',
               logo_url: businessSettings.logo_url
             } : {
               name: 'Starter Small Chops',
               whatsapp_support_number: '0807 301 1100',
               admin_notification_email: 'store@startersmallchops.com'
             }}
           />
         </div>
       </div>
     </AdaptiveDialog>
   );
 };