import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Separator } from '@/components/ui/separator';
import { Card } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { format } from 'date-fns';
import { StatusTransitionValidator, getValidTransitions } from './StatusTransitionValidator';
import { OrderAuditLogViewer } from './OrderAuditLogViewer';
import { OrderWithItems } from '@/api/orders';
import { OrderStatus, PaymentStatus } from '@/types/orders';
import { updateOrder } from '@/api/orders';
import { 
  Save, 
  AlertTriangle, 
  Clock, 
  User, 
  CreditCard, 
  Truck,
  X,
  History,
  CheckCircle
} from 'lucide-react';

interface EnhancedOrderUpdateModalProps {
  order: OrderWithItems | null;
  isOpen: boolean;
  onClose: () => void;
  onOrderUpdated: (updatedOrder: OrderWithItems) => void;
}

// Define allowed fields for updating (whitelist approach)
const ALLOWED_UPDATE_FIELDS = {
  // Core order fields
  status: { label: 'Order Status', type: 'select', critical: true },
  payment_status: { label: 'Payment Status', type: 'select', critical: true },
  
  // Customer information
  customer_name: { label: 'Customer Name', type: 'text', critical: false },
  customer_phone: { label: 'Customer Phone', type: 'text', critical: false },
  customer_email: { label: 'Customer Email', type: 'email', critical: false },
  
  // Delivery information
  delivery_address: { label: 'Delivery Address', type: 'textarea', critical: false },
  special_instructions: { label: 'Special Instructions', type: 'textarea', critical: false },
  
  // Order details  
  admin_notes: { label: 'Admin Notes', type: 'textarea', critical: false },
  
  // Rider assignment
  assigned_rider_id: { label: 'Assigned Rider', type: 'select', critical: false }
} as const;

const BLOCKED_FIELDS = [
  'id', 'order_number', 'total_amount', 'created_at', 'updated_at', 
  'order_items', 'delivery_fee', 'tax_amount', 'subtotal'
];

export const EnhancedOrderUpdateModal: React.FC<EnhancedOrderUpdateModalProps> = ({
  order,
  isOpen,
  onClose,
  onOrderUpdated
}) => {
  const [formData, setFormData] = useState<Partial<OrderWithItems>>({});
  const [validationErrors, setValidationErrors] = useState<Record<string, string>>({});
  const [isValidTransition, setIsValidTransition] = useState(true);
  const [transitionMessage, setTransitionMessage] = useState<string>('');
  const [isSaving, setIsSaving] = useState(false);
  const [showAuditLog, setShowAuditLog] = useState(false);
  const [confirmationReason, setConfirmationReason] = useState('');
  const [showConfirmation, setShowConfirmation] = useState(false);
  const { toast } = useToast();

  useEffect(() => {
    if (order) {
      // Initialize form with current order data, only for allowed fields
      const initialData: any = {};
      Object.keys(ALLOWED_UPDATE_FIELDS).forEach(field => {
        const value = order[field as keyof OrderWithItems];
        if (value !== undefined) {
          initialData[field] = value;
        }
      });
      setFormData(initialData);
      setValidationErrors({});
      setTransitionMessage('');
      setConfirmationReason('');
      setShowConfirmation(false);
    }
  }, [order]);

  const handleFieldChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    
    // Clear field-specific validation error
    if (validationErrors[field]) {
      setValidationErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    }
  };

  const validateForm = (): boolean => {
    const errors: Record<string, string> = {};

    if (formData.customer_email && !/^[^\\s@]+@[^\\s@]+\\.[^\\s@]+$/.test(formData.customer_email)) {
      errors.customer_email = 'Invalid email format';
    }

    if (formData.customer_phone && !/^\+?[\d\s()-]+$/.test(formData.customer_phone)) {
      errors.customer_phone = 'Invalid phone number format';
    }

    setValidationErrors(errors);
    return Object.keys(errors).length === 0;
  };

  const getCriticalChanges = () => {
    if (!order) return [];
    
    const criticalChanges = [];
    
    if (formData.status !== order.status) {
      criticalChanges.push(`Status: ${order.status} → ${formData.status}`);
    }
    
    if (formData.payment_status !== order.payment_status) {
      criticalChanges.push(`Payment: ${order.payment_status} → ${formData.payment_status}`);
    }
    
    return criticalChanges;
  };

  const handleSave = async () => {
    if (!order || !validateForm()) return;

    const criticalChanges = getCriticalChanges();
    
    // Require confirmation for critical changes
    if (criticalChanges.length > 0 && !showConfirmation) {
      setShowConfirmation(true);
      return;
    }

    if (criticalChanges.length > 0 && !confirmationReason.trim()) {
      toast({
        title: "Confirmation Required",
        description: "Please provide a reason for this critical change",
        variant: "destructive",
      });
      return;
    }

    setIsSaving(true);
    try {
      // Filter out unchanged fields to minimize update payload
      const changedFields: any = {};
      Object.keys(ALLOWED_UPDATE_FIELDS).forEach(field => {
        const newValue = formData[field as keyof typeof formData];
        const oldValue = order[field as keyof OrderWithItems];
        if (newValue !== oldValue && newValue !== undefined) {
          changedFields[field] = newValue;
        }
      });

      if (Object.keys(changedFields).length === 0) {
        toast({
          title: "No Changes",
          description: "No changes were made to the order",
        });
        onClose();
        return;
      }

      // Add admin reason for critical changes
      if (confirmationReason.trim()) {
        changedFields.admin_notes = 
          `${order.admin_notes || ''}\n\n[${new Date().toISOString()}] Admin Update: ${confirmationReason}`.trim();
      }

      const updatedOrder = await updateOrder(order.id, changedFields);
      
      toast({
        title: "Order Updated",
        description: "Order has been updated successfully",
      });

      onOrderUpdated(updatedOrder);
      onClose();
    } catch (error: any) {
      console.error('Error updating order:', error);
      toast({
        title: "Update Failed",
        description: error.message || "Failed to update order",
        variant: "destructive",
      });
    } finally {
      setIsSaving(false);
    }
  };

  const handleValidationResult = (isValid: boolean, message?: string) => {
    setIsValidTransition(isValid);
    setTransitionMessage(message || '');
  };

  if (!order) return null;

  const criticalChanges = getCriticalChanges();
  const validTransitions = getValidTransitions(order.status);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <div className="flex items-center gap-2">
              Update Order: {order.order_number}
              <Badge variant="outline">{order.status}</Badge>
            </div>
          </DialogTitle>
        </DialogHeader>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Update Form */}
          <div className="lg:col-span-2 space-y-6">
            {/* Critical Changes Alert */}
            {showConfirmation && criticalChanges.length > 0 && (
              <Alert className="border-orange-200 bg-orange-50">
                <AlertTriangle className="h-4 w-4 text-orange-600" />
                <AlertDescription>
                  <div className="space-y-2">
                    <p className="font-medium text-orange-800">Critical Changes Detected:</p>
                    <ul className="list-disc list-inside text-sm text-orange-700">
                      {criticalChanges.map((change, index) => (
                        <li key={index}>{change}</li>
                      ))}
                    </ul>
                    <div className="mt-3">
                      <Label htmlFor="confirmationReason" className="text-orange-800">
                        Reason for change (required):
                      </Label>
                      <Textarea
                        id="confirmationReason"
                        value={confirmationReason}
                        onChange={(e) => setConfirmationReason(e.target.value)}
                        placeholder="Explain why this change is necessary..."
                        className="mt-1"
                      />
                    </div>
                  </div>
                </AlertDescription>
              </Alert>
            )}

            {/* Status Transition Validation */}
            {formData.status && formData.status !== order.status && (
              <StatusTransitionValidator
                currentStatus={order.status}
                targetStatus={formData.status}
                onValidationResult={handleValidationResult}
              />
            )}

            {/* Form Fields */}
            <div className="space-y-4">
              {/* Order Status */}
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <Clock className="h-4 w-4" />
                    Order Status
                  </Label>
                  <Select 
                    value={formData.status || order.status} 
                    onValueChange={(value) => handleFieldChange('status', value)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value={order.status}>
                        {order.status} (current)
                      </SelectItem>
                      {validTransitions.map((status) => (
                        <SelectItem key={status} value={status}>
                          {status}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                <div className="space-y-2">
                  <Label className="flex items-center gap-2">
                    <CreditCard className="h-4 w-4" />
                    Payment Status
                  </Label>
                  <Select 
                    value={formData.payment_status || order.payment_status || 'pending'} 
                    onValueChange={(value) => handleFieldChange('payment_status', value as PaymentStatus)}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="pending">Pending</SelectItem>
                      <SelectItem value="paid">Paid</SelectItem>
                      <SelectItem value="failed">Failed</SelectItem>
                      <SelectItem value="refunded">Refunded</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
              </div>

              <Separator />

              {/* Customer Information */}
              <div>
                <h4 className="font-medium mb-3 flex items-center gap-2">
                  <User className="h-4 w-4" />
                  Customer Information
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Customer Name</Label>
                    <Input
                      value={formData.customer_name || ''}
                      onChange={(e) => handleFieldChange('customer_name', e.target.value)}
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Customer Phone</Label>
                    <Input
                      value={formData.customer_phone || ''}
                      onChange={(e) => handleFieldChange('customer_phone', e.target.value)}
                      className={validationErrors.customer_phone ? 'border-red-500' : ''}
                    />
                    {validationErrors.customer_phone && (
                      <p className="text-sm text-red-600">{validationErrors.customer_phone}</p>
                    )}
                  </div>
                  <div className="space-y-2 md:col-span-2">
                    <Label>Customer Email</Label>
                    <Input
                      type="email"
                      value={formData.customer_email || ''}
                      onChange={(e) => handleFieldChange('customer_email', e.target.value)}
                      className={validationErrors.customer_email ? 'border-red-500' : ''}
                    />
                    {validationErrors.customer_email && (
                      <p className="text-sm text-red-600">{validationErrors.customer_email}</p>
                    )}
                  </div>
                </div>
              </div>

              <Separator />

              {/* Delivery Information */}
              {order.order_type === 'delivery' && (
                <div>
                  <h4 className="font-medium mb-3 flex items-center gap-2">
                    <Truck className="h-4 w-4" />
                    Delivery Information
                  </h4>
                  <div className="space-y-4">
                    <div className="space-y-2">
                      <Label>Delivery Address</Label>
                      <Textarea
                        value={(formData.delivery_address as string) || ''}
                        onChange={(e) => handleFieldChange('delivery_address', e.target.value)}
                        rows={3}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Special Instructions</Label>
                      <Textarea
                        value={formData.special_instructions || ''}
                        onChange={(e) => handleFieldChange('special_instructions', e.target.value)}
                        rows={2}
                        placeholder="Special delivery instructions..."
                      />
                    </div>
                  </div>
                </div>
              )}

              <Separator />

              {/* Notes */}
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Admin Notes</Label>
                  <Textarea
                    value={formData.admin_notes || ''}
                    onChange={(e) => handleFieldChange('admin_notes', e.target.value)}
                    placeholder="Internal admin notes..."
                    rows={3}
                  />
                </div>
              </div>
            </div>
          </div>

          {/* Sidebar - Order Info & Audit Log */}
          <div className="space-y-4">
            {/* Order Info */}
            <Card className="p-4">
              <h4 className="font-medium mb-3">Order Information</h4>
              <div className="space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Number:</span>
                  <span className="font-mono">{order.order_number}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Total Amount:</span>
                  <span className="font-medium">₦{order.total_amount?.toLocaleString()}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Order Type:</span>
                  <Badge variant="outline">{order.order_type}</Badge>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Created:</span>
                  <span>{format(new Date(order.created_at), 'MMM d, yyyy')}</span>
                </div>
              </div>
            </Card>

            {/* Toggle Audit Log */}
            <Button
              variant="outline"
              onClick={() => setShowAuditLog(!showAuditLog)}
              className="w-full"
            >
              <History className="h-4 w-4 mr-2" />
              {showAuditLog ? 'Hide' : 'Show'} Activity Log
            </Button>
          </div>
        </div>

        {/* Audit Log - Full Width */}
        {showAuditLog && (
          <div className="mt-6">
            <OrderAuditLogViewer orderId={order.id} />
          </div>
        )}

        <DialogFooter className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            {!isValidTransition && (
              <div className="flex items-center gap-2 text-red-600">
                <X className="h-4 w-4" />
                <span className="text-sm">{transitionMessage}</span>
              </div>
            )}
          </div>
          
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose}>
              Cancel
            </Button>
            <Button 
              onClick={handleSave} 
              disabled={isSaving || (!isValidTransition && formData.status !== order.status)}
            >
              {isSaving ? (
                <>
                  <div className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent mr-2" />
                  Saving...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {showConfirmation ? 'Confirm Update' : 'Save Changes'}
                </>
              )}
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};
