import jsPDF from 'jspdf';
import 'jspdf-autotable';
import { format } from 'date-fns';

export interface OrderExportData {
  order: any;
  items: any[];
  schedule?: any;
  paymentTx?: any;
  pickupPoint?: any;
}

export function exportOrderToPDF({
  order,
  items,
  schedule,
  paymentTx,
  pickupPoint
}: OrderExportData): void {
  const doc = new jsPDF();
  
  // Header
  doc.setFontSize(20);
  doc.text(`Order Details: #${order.order_number}`, 20, 30);
  
  // Order Information
  doc.setFontSize(14);
  doc.text('Order Information', 20, 50);
  doc.setFontSize(10);
  const orderInfo = [
    ['Order Number', order.order_number],
    ['Order Time', format(new Date(order.order_time), 'PPpp')],
    ['Type', order.order_type],
    ['Status', order.status],
    ['Payment Status', order.payment_status],
    ['Total Amount', `₦${order.total_amount?.toLocaleString()}`],
  ];
  
  (doc as any).autoTable({
    startY: 55,
    head: [['Field', 'Value']],
    body: orderInfo,
    theme: 'grid',
    margin: { left: 20 }
  });
  
  // Customer Information
  let currentY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(14);
  doc.text('Customer Information', 20, currentY);
  doc.setFontSize(10);
  
  const customerInfo = [
    ['Name', order.customer_name],
    ['Phone', order.customer_phone],
    ['Email', order.customer_email],
  ];
  
  if (order.order_type === 'delivery' && order.delivery_address) {
    customerInfo.push(['Address', JSON.stringify(order.delivery_address)]);
  }
  
  if (order.order_type === 'pickup' && pickupPoint) {
    customerInfo.push(['Pickup Point', pickupPoint.name]);
  }
  
  (doc as any).autoTable({
    startY: currentY + 5,
    head: [['Field', 'Value']],
    body: customerInfo,
    theme: 'grid',
    margin: { left: 20 }
  });
  
  // Order Items
  currentY = (doc as any).lastAutoTable.finalY + 20;
  doc.setFontSize(14);
  doc.text('Order Items', 20, currentY);
  
  const itemsData = items.map(item => [
    item.product?.name || item.product_name || 'Unknown Product',
    item.quantity.toString(),
    `₦${item.unit_price?.toLocaleString()}`,
    `₦${item.total_price?.toLocaleString()}`,
    item.product?.features?.join(', ') || 'N/A'
  ]);
  
  (doc as any).autoTable({
    startY: currentY + 5,
    head: [['Product', 'Qty', 'Unit Price', 'Total', 'Features']],
    body: itemsData,
    theme: 'striped',
    margin: { left: 20 }
  });
  
  // Payment Information
  if (paymentTx) {
    currentY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text('Payment Information', 20, currentY);
    doc.setFontSize(10);
    
    const paymentInfo = [
      ['Reference', order.payment_reference],
      ['Method', paymentTx.channel || order.payment_method],
      ['Status', paymentTx.status],
      ['Amount', `₦${paymentTx.amount?.toLocaleString()}`],
      ['Paid At', paymentTx.paid_at ? format(new Date(paymentTx.paid_at), 'PPpp') : 'N/A'],
    ];
    
    (doc as any).autoTable({
      startY: currentY + 5,
      head: [['Field', 'Value']],
      body: paymentInfo,
      theme: 'grid',
      margin: { left: 20 }
    });
  }
  
  // Schedule Information
  if (schedule) {
    currentY = (doc as any).lastAutoTable.finalY + 20;
    doc.setFontSize(14);
    doc.text('Delivery/Pickup Schedule', 20, currentY);
    doc.setFontSize(10);
    
    const scheduleInfo = [
      ['Date', schedule.delivery_date],
      ['Time', `${schedule.delivery_time_start} - ${schedule.delivery_time_end}`],
      ['Zone', schedule.delivery_zone || 'N/A'],
    ];
    
    if (schedule.special_instructions) {
      scheduleInfo.push(['Instructions', schedule.special_instructions]);
    }
    
    (doc as any).autoTable({
      startY: currentY + 5,
      head: [['Field', 'Value']],
      body: scheduleInfo,
      theme: 'grid',
      margin: { left: 20 }
    });
  }
  
  // Footer
  const pageCount = (doc as any).internal.getNumberOfPages();
  for (let i = 1; i <= pageCount; i++) {
    doc.setPage(i);
    doc.setFontSize(8);
    doc.text(
      `Generated on ${format(new Date(), 'PPP')} • Page ${i} of ${pageCount}`,
      20,
      doc.internal.pageSize.height - 10
    );
  }
  
  doc.save(`order_${order.order_number}.pdf`);
}

export function exportOrderToCSV({
  order,
  items,
  schedule,
  paymentTx,
  pickupPoint
}: OrderExportData): void {
  const csvData = [];
  
  // Order Information
  csvData.push(['ORDER INFORMATION']);
  csvData.push(['Order Number', order.order_number]);
  csvData.push(['Order Time', format(new Date(order.order_time), 'PPpp')]);
  csvData.push(['Type', order.order_type]);
  csvData.push(['Status', order.status]);
  csvData.push(['Payment Status', order.payment_status]);
  csvData.push(['Total Amount', `₦${order.total_amount?.toLocaleString()}`]);
  csvData.push([]);
  
  // Customer Information
  csvData.push(['CUSTOMER INFORMATION']);
  csvData.push(['Name', order.customer_name]);
  csvData.push(['Phone', order.customer_phone]);
  csvData.push(['Email', order.customer_email]);
  
  if (order.order_type === 'delivery' && order.delivery_address) {
    csvData.push(['Address', JSON.stringify(order.delivery_address)]);
  }
  
  if (order.order_type === 'pickup' && pickupPoint) {
    csvData.push(['Pickup Point', pickupPoint.name]);
  }
  
  csvData.push([]);
  
  // Order Items
  csvData.push(['ORDER ITEMS']);
  csvData.push(['Product', 'Quantity', 'Unit Price', 'Total Price', 'Features']);
  
  items.forEach(item => {
    csvData.push([
      item.product?.name || item.product_name || 'Unknown Product',
      item.quantity,
      `₦${item.unit_price?.toLocaleString()}`,
      `₦${item.total_price?.toLocaleString()}`,
      item.product?.features?.join(', ') || 'N/A'
    ]);
  });
  
  csvData.push([]);
  
  // Payment Information
  if (paymentTx) {
    csvData.push(['PAYMENT INFORMATION']);
    csvData.push(['Reference', order.payment_reference]);
    csvData.push(['Method', paymentTx.channel || order.payment_method]);
    csvData.push(['Status', paymentTx.status]);
    csvData.push(['Amount', `₦${paymentTx.amount?.toLocaleString()}`]);
    csvData.push(['Paid At', paymentTx.paid_at ? format(new Date(paymentTx.paid_at), 'PPpp') : 'N/A']);
    csvData.push([]);
  }
  
  // Schedule Information
  if (schedule) {
    csvData.push(['DELIVERY/PICKUP SCHEDULE']);
    csvData.push(['Date', schedule.delivery_date]);
    csvData.push(['Time', `${schedule.delivery_time_start} - ${schedule.delivery_time_end}`]);
    csvData.push(['Zone', schedule.delivery_zone || 'N/A']);
    
    if (schedule.special_instructions) {
      csvData.push(['Instructions', schedule.special_instructions]);
    }
  }
  
  // Convert to CSV string
  const csvString = csvData
    .map(row => row.map(cell => `"${cell || ''}"`).join(','))
    .join('\n');
  
  // Download CSV
  const blob = new Blob([csvString], { type: 'text/csv;charset=utf-8;' });
  const link = document.createElement('a');
  
  if (link.download !== undefined) {
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', `order_${order.order_number}.csv`);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  }
}