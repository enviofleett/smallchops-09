import { useState } from 'react';
import { toast } from 'sonner';
import { OrderWithItems } from '@/api/orders';
import { supabase } from '@/integrations/supabase/client';
import { generateReceiptContent } from '@/utils/receiptGenerator';

interface BusinessInfo {
  name: string;
  admin_notification_email?: string;
  whatsapp_support_number?: string;
  logo_url?: string;
  printed_by?: string;
  printed_on?: string;
}

export const useThermalPrint = () => {
  const [isPrinting, setIsPrinting] = useState(false);
  const [isPreviewOpen, setIsPreviewOpen] = useState(false);
  const [previewOrder, setPreviewOrder] = useState<OrderWithItems | null>(null);
  const [previewDeliverySchedule, setPreviewDeliverySchedule] = useState<any>(null);
  const [previewBusinessInfo, setPreviewBusinessInfo] = useState<BusinessInfo | null>(null);

  const printThermalReceipt = async (order: OrderWithItems, deliverySchedule?: any, businessInfo?: BusinessInfo) => {
    if (!order) {
      toast.error('No order data available for printing');
      return;
    }

    setIsPrinting(true);
    
    // Fetch pickup point details if needed
    let pickupPoint = null;
    if (order.order_type === 'pickup' && order.pickup_point_id) {
      try {
        const { data } = await supabase
          .from('pickup_points')
          .select('*')
          .eq('id', order.pickup_point_id)
          .single();
        pickupPoint = data;
      } catch (error) {
        console.warn('Failed to fetch pickup point details:', error);
      }
    }

    try {
      // Import the thermal print styles
      if (!document.querySelector('#thermal-print-styles')) {
        const link = document.createElement('link');
        link.id = 'thermal-print-styles';
        link.rel = 'stylesheet';
        link.href = '/src/styles/thermal-print.css';
        document.head.appendChild(link);
        
        // Wait for stylesheet to load
        await new Promise((resolve) => {
          link.onload = resolve;
          link.onerror = resolve; // Continue even if load fails
        });
      }

      // Create a temporary div for the receipt
      const printContainer = document.createElement('div');
      printContainer.className = 'thermal-receipt';
      
      // Generate receipt content using shared utility
      const receiptContent = generateReceiptContent({
        order,
        deliverySchedule,
        businessInfo,
        pickupPoint
      });
      
      // Generate the receipt HTML
      printContainer.innerHTML = `
        <div class="receipt-content">
          <div class="text-center mb-2">
            <div class="business-name">${receiptContent.businessName}</div>
            ${receiptContent.contactNumber ? 
              `<div class="contact">Contact: ${receiptContent.contactNumber}</div>` : ''}
          </div>
          
          <div class="divider">- - - - - - - - - - - - - - - - - -</div>
          
          <div class="order-info">
            <div>ORDER #: ${order.order_number}</div>
            <div>Date: ${receiptContent.formattedDate}</div>
            <div>Type: ${receiptContent.getOrderTypeDisplay()}</div>
            <div>Status: ${order.status?.replace('_', ' ').toUpperCase()}</div>
          </div>
          
          <div class="divider">- - - - - - - - - - - - - - - - - -</div>
          
          <div class="customer-info">
            <div class="section-header">CUSTOMER INFO:</div>
            <div>Name: ${order.customer_name}</div>
            ${order.customer_phone ? `<div>Phone: ${order.customer_phone}</div>` : ''}
            ${order.customer_email ? `<div>Email: ${order.customer_email}</div>` : ''}
          </div>
          
          <div class="divider">- - - - - - - - - - - - - - - - - -</div>
          
          <div class="delivery-schedule">
            <div class="section-header">${receiptContent.getOrderTypeDisplay().toUpperCase()} SCHEDULE:</div>
            
            ${order.order_type === 'delivery' ? `
              ${deliverySchedule ? `
                <div>Scheduled Date: ${receiptContent.formattedScheduleDate}</div>
                <div>Time Window: ${deliverySchedule.delivery_time_start} - ${deliverySchedule.delivery_time_end}</div>
                ${deliverySchedule.is_flexible ? '<div>Flexible: Yes</div>' : ''}
                ${deliverySchedule.special_instructions ? 
                  `<div>Special Notes: ${deliverySchedule.special_instructions}</div>` : ''}
              ` : ''}
              ${receiptContent.deliveryInfo?.address ? `<div>Delivery Address: ${receiptContent.deliveryInfo.address}</div>` : ''}
              ${receiptContent.deliveryInfo?.instructions ? `<div>Delivery Instructions: ${receiptContent.deliveryInfo.instructions}</div>` : ''}
              ${!deliverySchedule && receiptContent.deliveryInfo?.address ? '<div>⚠️ No scheduled delivery window</div>' : ''}
            ` : ''}
            
            ${order.order_type === 'pickup' ? `
              ${deliverySchedule ? `
                <div>Scheduled Date: ${receiptContent.formattedScheduleDate}</div>
                <div>Pickup Window: ${deliverySchedule.delivery_time_start} - ${deliverySchedule.delivery_time_end}</div>
                ${deliverySchedule.is_flexible ? '<div>Flexible: Yes</div>' : ''}
                ${deliverySchedule.special_instructions ? 
                  `<div>Special Notes: ${deliverySchedule.special_instructions}</div>` : ''}
              ` : ''}
              ${pickupPoint ? `
                <div>Pickup Location: ${pickupPoint.name}</div>
                <div>Location Address: ${pickupPoint.address}</div>
                ${pickupPoint.contact_phone ? `<div>Location Phone: ${pickupPoint.contact_phone}</div>` : ''}
                ${receiptContent.pickupPointHours ? `<div>Operating Hours: ${receiptContent.pickupPointHours}</div>` : ''}
              ` : ''}
              ${!deliverySchedule && !pickupPoint ? '<div>⚠️ No pickup schedule or location</div>' : ''}
            ` : ''}
          </div>
          
          <div class="divider">- - - - - - - - - - - - - - - - - -</div>
          
          <div class="items-section">
            <div class="section-header">ORDER ITEMS & DETAILS:</div>
            <div class="divider">- - - - - - - - - - - - - - - -</div>
            
            ${order.order_items?.map((item, index) => {
              const itemDetails = receiptContent.getItemDetails(item);
              return `
                <div class="item-block">
                  <div class="item-header">
                    <span>${item.product_name}</span>
                    <span class="item-total">${receiptContent.formatCurrency(item.total_price || 0)}</span>
                  </div>
                  <div class="item-meta">
                    Qty: ${item.quantity}${item.unit_price ? 
                      ` @ ${receiptContent.formatCurrency(item.unit_price)}` : ''}
                  </div>
                  
                  ${itemDetails.map(detail => 
                    `<div class="item-detail">${detail}</div>`
                  ).join('')}
                  
                  ${index < order.order_items.length - 1 ? '<div class="item-spacer"></div>' : ''}
                </div>
              `;
            }).join('') || '<div>No items found</div>'}
            
            <div class="divider">- - - - - - - - - - - - - - - -</div>
          </div>
          
          <div class="order-summary">
            <div class="section-header">ORDER SUMMARY:</div>
            <div class="summary-line">
              <span>Subtotal:</span>
              <span>${receiptContent.formatCurrency(order.subtotal || 0)}</span>
            </div>
            ${order.delivery_fee && order.delivery_fee > 0 ? `
              <div class="summary-line">
                <span>Delivery Fee:</span>
                <span>${receiptContent.formatCurrency(order.delivery_fee)}</span>
              </div>
            ` : ''}
            ${order.total_vat && order.total_vat > 0 ? `
              <div class="summary-line">
                <span>VAT (${((order.total_vat / (order.subtotal || 1)) * 100).toFixed(1)}%):</span>
                <span>${receiptContent.formatCurrency(order.total_vat)}</span>
              </div>
            ` : ''}
            ${order.discount_amount && order.discount_amount > 0 ? `
              <div class="summary-line discount">
                <span>Discount:</span>
                <span>-${receiptContent.formatCurrency(order.discount_amount)}</span>
              </div>
            ` : ''}
            <div class="total-line">
              <span class="total-label">TOTAL:</span>
              <span class="total-amount">${receiptContent.formatCurrency(order.total_amount)}</span>
            </div>
          </div>
          
          <div class="divider">- - - - - - - - - - - - - - - - - -</div>
          
          <div class="payment-info">
            <div class="section-header">PAYMENT DETAILS:</div>
            <div>Method: ${order.payment_method || 'N/A'}</div>
            <div>Status: ${order.payment_status?.replace('_', ' ').toUpperCase()}</div>
            ${order.payment_reference ? `<div>Ref: ${order.payment_reference}</div>` : ''}
          </div>
          
          ${order.special_instructions ? `
            <div class="divider">- - - - - - - - - - - - - - - - - -</div>
            <div class="special-instructions">
              <div class="section-header">PREPARATION NOTES:</div>
              <div>${order.special_instructions}</div>
            </div>
          ` : ''}
          
          <div class="divider">- - - - - - - - - - - - - - - - - -</div>
          
          <div class="footer text-center">
            <div>Thank you for your order!</div>
            <div>Starters Small Chops</div>
            ${receiptContent.adminEmail ? 
              `<div>${receiptContent.adminEmail}</div>` : ''}
            
            <div class="divider">- - - - - - - - - - - - - - - - - -</div>
            
            ${businessInfo?.printed_by ? `
              <div class="admin-print-info" style="font-size: 7px; margin-top: 4px;">
                <div style="font-weight: bold;">Printed by: ${businessInfo.printed_by}</div>
                ${businessInfo.printed_on ? 
                  `<div>On: ${businessInfo.printed_on}</div>` : ''}
              </div>
            ` : ''}
          </div>
        </div>
      `;

      // Add to DOM temporarily
      document.body.appendChild(printContainer);
      
      // Trigger print
      window.print();
      
      // Clean up
      document.body.removeChild(printContainer);
      
      toast.success('Receipt sent to printer successfully!');
      
    } catch (error) {
      console.error('Print error:', error);
      toast.error('Failed to print receipt. Please try again.');
    } finally {
      setIsPrinting(false);
    }
  };

  const showPreview = async (order: OrderWithItems, deliverySchedule?: any, businessInfo?: BusinessInfo) => {
    // Fetch pickup point details if needed for preview
    if (order.order_type === 'pickup' && order.pickup_point_id) {
      try {
        const { data } = await supabase
          .from('pickup_points')
          .select('*')
          .eq('id', order.pickup_point_id)
          .single();
        // Store pickup point data in the order object for preview
        (order as any).pickup_point = data;
      } catch (error) {
        console.warn('Failed to fetch pickup point details for preview:', error);
      }
    }
    
    setPreviewOrder(order);
    setPreviewDeliverySchedule(deliverySchedule);
    setPreviewBusinessInfo(businessInfo);
    setIsPreviewOpen(true);
  };

  const closePreview = () => {
    setIsPreviewOpen(false);
    setPreviewOrder(null);
    setPreviewDeliverySchedule(null);
    setPreviewBusinessInfo(null);
  };

  const printFromPreview = async () => {
    if (previewOrder) {
      await printThermalReceipt(previewOrder, previewDeliverySchedule, previewBusinessInfo);
      closePreview();
    }
  };

  return {
    printThermalReceipt,
    showPreview,
    closePreview,
    printFromPreview,
    isPrinting,
    isPreviewOpen,
    previewOrder,
    previewDeliverySchedule,
    previewBusinessInfo
  };
};