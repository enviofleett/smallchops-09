import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import startersLogo from '@/assets/starters-logo.png';

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
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 15;

  // Brand colors
  const primaryColor: [number, number, number] = [231, 76, 60]; // Red brand color
  const darkGray: [number, number, number] = [51, 51, 51];
  const lightGray: [number, number, number] = [128, 128, 128];

  // Add logo
  const logoImg = new Image();
  logoImg.src = startersLogo;
  
  try {
    doc.addImage(logoImg, 'PNG', pageWidth / 2 - 15, yPos, 30, 30);
    yPos += 35;
  } catch (error) {
    console.error('Error adding logo:', error);
    yPos += 5;
  }

  // Business Name
  doc.setFontSize(24);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text(businessInfo?.name || 'Starters', pageWidth / 2, yPos, { align: 'center' });
  yPos += 8;

  // Business Info
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  if (businessInfo?.address) {
    doc.text(businessInfo.address, pageWidth / 2, yPos, { align: 'center' });
    yPos += 5;
  }
  
  const contactInfo = [];
  if (businessInfo?.phone) contactInfo.push(`Tel: ${businessInfo.phone}`);
  if (businessInfo?.email) contactInfo.push(`Email: ${businessInfo.email}`);
  
  if (contactInfo.length > 0) {
    doc.text(contactInfo.join('  |  '), pageWidth / 2, yPos, { align: 'center' });
    yPos += 8;
  }

  // Decorative line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(40, yPos, pageWidth - 40, yPos);
  yPos += 12;

  // Receipt Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkGray);
  doc.text('ORDER RECEIPT', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Order Details Box
  const boxPadding = 5;
  const boxX = 15;
  const boxWidth = pageWidth - 30;
  const boxStartY = yPos;

  doc.setFillColor(250, 250, 250);
  doc.roundedRect(boxX, boxStartY, boxWidth, 28, 2, 2, 'F');
  
  yPos += 7;
  doc.setFontSize(10);
  doc.setTextColor(...darkGray);
  
  // Two column layout for order info
  const leftCol = boxX + boxPadding + 2;
  const midCol = pageWidth / 2;

  doc.setFont('helvetica', 'bold');
  doc.text('Order Number:', leftCol, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(order.order_number, leftCol + 32, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', midCol, yPos);
  doc.setFont('helvetica', 'normal');
  const formattedDate = new Date(order.created_at).toLocaleDateString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric'
  });
  doc.text(formattedDate, midCol + 15, yPos);
  yPos += 7;

  if (order.payment_status) {
    doc.setFont('helvetica', 'bold');
    doc.text('Payment:', leftCol, yPos);
    doc.setFont('helvetica', 'normal');
    const statusColor = order.payment_status.toLowerCase() === 'paid' ? [34, 197, 94] : [234, 179, 8];
    doc.setTextColor(...(statusColor as [number, number, number]));
    doc.text(order.payment_status.toUpperCase(), leftCol + 32, yPos);
    doc.setTextColor(...darkGray);
  }

  if (order.status) {
    doc.setFont('helvetica', 'bold');
    doc.text('Status:', midCol, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(order.status.toUpperCase(), midCol + 15, yPos);
  }
  yPos += 7;

  yPos = boxStartY + 33;

  // Customer Information Section
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('CUSTOMER INFORMATION', 15, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  
  if (order.customer_name) {
    doc.setFont('helvetica', 'bold');
    doc.text('Name:', 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(order.customer_name, 35, yPos);
    yPos += 6;
  }
  if (order.customer_email) {
    doc.setFont('helvetica', 'bold');
    doc.text('Email:', 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(order.customer_email, 35, yPos);
    yPos += 6;
  }
  if (order.customer_phone) {
    doc.setFont('helvetica', 'bold');
    doc.text('Phone:', 15, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(order.customer_phone, 35, yPos);
    yPos += 6;
  }

  // Delivery Address
  if (order.order_type === 'delivery' && order.delivery_address) {
    yPos += 3;
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text('DELIVERY ADDRESS', 15, yPos);
    yPos += 6;
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...darkGray);
    const address = typeof order.delivery_address === 'string' 
      ? order.delivery_address 
      : order.delivery_address.address || order.delivery_address.address_line_1 || 'N/A';
    
    const addressLines = doc.splitTextToSize(address, pageWidth - 30);
    doc.text(addressLines, 15, yPos);
    yPos += addressLines.length * 6;
  }

  yPos += 10;

  // Order Items Section Header
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('ORDER ITEMS', 15, yPos);
  yPos += 8;

  // Items Table
  const items = order.items || order.order_items || [];
  const tableData = items.map((item) => [
    item.product_name || item.name || 'Unknown Item',
    item.quantity.toString(),
    `₦${((item.unit_price || item.price || 0).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}`,
    `₦${((item.total_price || (item.quantity * (item.unit_price || item.price || 0))).toLocaleString('en-NG', { minimumFractionDigits: 2, maximumFractionDigits: 2 }))}`
  ]);

  autoTable(doc, {
    startY: yPos,
    head: [['Item', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: {
      fillColor: primaryColor,
      textColor: [255, 255, 255],
      fontStyle: 'bold',
      fontSize: 10,
      halign: 'left',
      cellPadding: 5
    },
    bodyStyles: {
      fontSize: 10,
      cellPadding: 5,
      textColor: darkGray
    },
    alternateRowStyles: {
      fillColor: [250, 250, 250]
    },
    columnStyles: {
      0: { cellWidth: 'auto', fontStyle: 'normal' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 40, halign: 'right' },
      3: { cellWidth: 40, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 15, right: 15 }
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Payment Summary Box
  const summaryBoxX = pageWidth - 85;
  const summaryBoxWidth = 70;
  const summaryStartY = yPos;

  doc.setFillColor(250, 250, 250);
  doc.roundedRect(summaryBoxX, summaryStartY, summaryBoxWidth, 52, 2, 2, 'F');
  
  yPos += 7;
  const summaryX = summaryBoxX + 5;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);

  if (order.subtotal !== undefined && order.subtotal !== null) {
    doc.text('Subtotal:', summaryX, yPos);
    doc.text(`₦${order.subtotal.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, pageWidth - 20, yPos, { align: 'right' });
    yPos += 6;
  }

  if (order.tax_amount || order.vat_amount) {
    doc.text('VAT (7.5%):', summaryX, yPos);
    doc.text(`₦${((order.tax_amount || order.vat_amount || 0).toLocaleString('en-NG', { minimumFractionDigits: 2 }))}`, pageWidth - 20, yPos, { align: 'right' });
    yPos += 6;
  }

  if (order.delivery_fee) {
    doc.text('Delivery Fee:', summaryX, yPos);
    doc.text(`₦${order.delivery_fee.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, pageWidth - 20, yPos, { align: 'right' });
    yPos += 6;
  }

  if (order.discount_amount) {
    doc.setTextColor(34, 197, 94);
    doc.text('Discount:', summaryX, yPos);
    doc.text(`-₦${order.discount_amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, pageWidth - 20, yPos, { align: 'right' });
    doc.setTextColor(...darkGray);
    yPos += 6;
  }

  yPos += 2;
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(0.8);
  doc.line(summaryX, yPos, pageWidth - 20, yPos);
  yPos += 7;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(13);
  doc.setTextColor(...primaryColor);
  doc.text('TOTAL:', summaryX, yPos);
  doc.text(`₦${order.total_amount.toLocaleString('en-NG', { minimumFractionDigits: 2 })}`, pageWidth - 20, yPos, { align: 'right' });

  if (order.payment_method) {
    yPos = summaryStartY + 58;
    doc.setFontSize(9);
    doc.setFont('helvetica', 'italic');
    doc.setTextColor(...lightGray);
    doc.text(`Payment: ${order.payment_method.charAt(0).toUpperCase() + order.payment_method.slice(1)}`, summaryX, yPos);
  }

  // Footer
  const footerY = pageHeight - 25;
  
  // Thank you message
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('Thank you for your order!', pageWidth / 2, footerY, { align: 'center' });
  
  // Footer details
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...lightGray);
  const genDate = new Date().toLocaleString('en-GB', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit'
  });
  doc.text(`Generated on ${genDate}`, pageWidth / 2, footerY + 6, { align: 'center' });
  
  // Bottom line
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.3);
  doc.line(40, footerY + 10, pageWidth - 40, footerY + 10);
  
  doc.setFontSize(7);
  doc.text('This is a computer-generated receipt and does not require a signature', pageWidth / 2, footerY + 14, { align: 'center' });

  // Download the PDF
  const fileName = `Receipt-${order.order_number}.pdf`;
  doc.save(fileName);
};
