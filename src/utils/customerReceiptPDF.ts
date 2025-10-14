import jsPDF from 'jspdf';
import 'jspdf-autotable';

interface OrderItem {
  product_name?: string;
  name?: string;
  quantity: number;
  unit_price?: number;
  price?: number;
  total_price?: number;
}

interface Order {
  order_number: string;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  order_type?: string;
  delivery_address?: any;
  subtotal?: number;
  tax_amount?: number;
  vat_amount?: number;
  delivery_fee?: number;
  discount_amount?: number;
  total_amount: number;
  payment_method?: string;
  payment_status?: string;
  status?: string;
  items?: OrderItem[];
  order_items?: OrderItem[];
}

interface BusinessInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export const generateCustomerReceiptPDF = (
  order: Order,
  businessInfo?: BusinessInfo
): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  let yPos = 20;

  // Header - Business Info
  doc.setFontSize(20);
  doc.setFont('helvetica', 'bold');
  doc.text(businessInfo?.name || 'Receipt', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  if (businessInfo?.address || businessInfo?.phone || businessInfo?.email) {
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    if (businessInfo?.address) {
      doc.text(businessInfo.address, pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
    }
    if (businessInfo?.phone) {
      doc.text(`Tel: ${businessInfo.phone}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
    }
    if (businessInfo?.email) {
      doc.text(`Email: ${businessInfo.email}`, pageWidth / 2, yPos, { align: 'center' });
      yPos += 5;
    }
  }

  yPos += 5;
  doc.setLineWidth(0.5);
  doc.line(15, yPos, pageWidth - 15, yPos);
  yPos += 10;

  // Order Information
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.text('ORDER RECEIPT', pageWidth / 2, yPos, { align: 'center' });
  yPos += 10;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  
  // Two column layout for order info
  const leftCol = 15;
  const rightCol = pageWidth / 2 + 5;

  doc.setFont('helvetica', 'bold');
  doc.text('Order Number:', leftCol, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(order.order_number, leftCol + 35, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', rightCol, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(new Date(order.created_at).toLocaleDateString(), rightCol + 15, yPos);
  yPos += 7;

  if (order.payment_status) {
    doc.setFont('helvetica', 'bold');
    doc.text('Payment Status:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(order.payment_status.toUpperCase(), leftCol + 35, yPos);
  }

  if (order.status) {
    doc.setFont('helvetica', 'bold');
    doc.text('Order Status:', rightCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(order.status.toUpperCase(), rightCol + 30, yPos);
  }
  yPos += 10;

  // Customer Information
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.text('Customer Information', leftCol, yPos);
  yPos += 7;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  if (order.customer_name) {
    doc.text(`Name: ${order.customer_name}`, leftCol, yPos);
    yPos += 6;
  }
  if (order.customer_email) {
    doc.text(`Email: ${order.customer_email}`, leftCol, yPos);
    yPos += 6;
  }
  if (order.customer_phone) {
    doc.text(`Phone: ${order.customer_phone}`, leftCol, yPos);
    yPos += 6;
  }

  // Delivery Address
  if (order.order_type === 'delivery' && order.delivery_address) {
    yPos += 3;
    doc.setFont('helvetica', 'bold');
    doc.text('Delivery Address:', leftCol, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    const address = typeof order.delivery_address === 'string' 
      ? order.delivery_address 
      : order.delivery_address.address || order.delivery_address.address_line_1 || 'N/A';
    
    const addressLines = doc.splitTextToSize(address, pageWidth - 30);
    doc.text(addressLines, leftCol, yPos);
    yPos += addressLines.length * 6;
  }

  yPos += 10;

  // Items Table
  const items = order.items || order.order_items || [];
  const tableData = items.map((item) => [
    item.product_name || item.name || 'Unknown Item',
    item.quantity.toString(),
    `₦${((item.unit_price || item.price || 0).toLocaleString())}`,
    `₦${((item.total_price || (item.quantity * (item.unit_price || item.price || 0))).toLocaleString())}`
  ]);

  (doc as any).autoTable({
    startY: yPos,
    head: [['Item', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'striped',
    headStyles: {
      fillColor: [59, 130, 246],
      textColor: 255,
      fontStyle: 'bold',
      fontSize: 10
    },
    bodyStyles: {
      fontSize: 9
    },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 35, halign: 'right' },
      3: { cellWidth: 35, halign: 'right' }
    },
    margin: { left: 15, right: 15 }
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Payment Summary
  const summaryX = pageWidth - 70;
  doc.setFontSize(10);

  if (order.subtotal !== undefined && order.subtotal !== null) {
    doc.setFont('helvetica', 'normal');
    doc.text('Subtotal:', summaryX, yPos);
    doc.text(`₦${order.subtotal.toLocaleString()}`, pageWidth - 15, yPos, { align: 'right' });
    yPos += 6;
  }

  if (order.tax_amount || order.vat_amount) {
    doc.text('VAT (7.5%):', summaryX, yPos);
    doc.text(`₦${((order.tax_amount || order.vat_amount || 0).toLocaleString())}`, pageWidth - 15, yPos, { align: 'right' });
    yPos += 6;
  }

  if (order.delivery_fee) {
    doc.text('Delivery Fee:', summaryX, yPos);
    doc.text(`₦${order.delivery_fee.toLocaleString()}`, pageWidth - 15, yPos, { align: 'right' });
    yPos += 6;
  }

  if (order.discount_amount) {
    doc.setTextColor(220, 38, 38);
    doc.text('Discount:', summaryX, yPos);
    doc.text(`-₦${order.discount_amount.toLocaleString()}`, pageWidth - 15, yPos, { align: 'right' });
    doc.setTextColor(0, 0, 0);
    yPos += 6;
  }

  yPos += 2;
  doc.setLineWidth(0.3);
  doc.line(summaryX, yPos, pageWidth - 15, yPos);
  yPos += 6;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(12);
  doc.text('TOTAL:', summaryX, yPos);
  doc.text(`₦${order.total_amount.toLocaleString()}`, pageWidth - 15, yPos, { align: 'right' });

  if (order.payment_method) {
    yPos += 8;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.text(`Payment Method: ${order.payment_method}`, summaryX, yPos);
  }

  // Footer
  const footerY = doc.internal.pageSize.getHeight() - 20;
  doc.setFontSize(8);
  doc.setFont('helvetica', 'italic');
  doc.setTextColor(100, 100, 100);
  doc.text('Thank you for your order!', pageWidth / 2, footerY, { align: 'center' });
  doc.text(`Generated on ${new Date().toLocaleString()}`, pageWidth / 2, footerY + 5, { align: 'center' });

  // Download the PDF
  const fileName = `Receipt-${order.order_number}.pdf`;
  doc.save(fileName);
};
