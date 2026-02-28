import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import startersLogo from '@/assets/starters-logo.png';

interface VirtualAccount {
  account_number: string;
  bank_name: string;
  account_name: string;
}

interface OrderItem {
  product_name?: string;
  name?: string;
  quantity: number;
  unit_price?: number;
  price?: number;
  total_price?: number;
}

interface AdminOrder {
  order_number: string;
  created_at: string;
  customer_name?: string;
  customer_email?: string;
  customer_phone?: string;
  order_type?: string;
  delivery_address?: any;
  subtotal?: number;
  delivery_fee?: number;
  total_amount: number;
  payment_status?: string;
  status?: string;
  items?: OrderItem[];
  order_items?: OrderItem[];
}

const formatCurrency = (amount: number): string => {
  const num = Number(amount) || 0;
  const formatted = num.toFixed(2);
  const parts = formatted.split('.');
  parts[0] = parts[0].replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  return `₦${parts.join('.')}`;
};

export const generateAdminOrderPDF = (
  order: AdminOrder,
  virtualAccount?: VirtualAccount | null,
  businessInfo?: { name: string; address?: string; phone?: string; email?: string }
): void => {
  const doc = new jsPDF();
  const pageWidth = doc.internal.pageSize.getWidth();
  const pageHeight = doc.internal.pageSize.getHeight();
  let yPos = 15;

  const primaryColor: [number, number, number] = [231, 76, 60];
  const darkGray: [number, number, number] = [51, 51, 51];
  const lightGray: [number, number, number] = [128, 128, 128];
  const blueAccent: [number, number, number] = [41, 128, 185];

  // Logo
  try {
    const logoImg = new Image();
    logoImg.src = startersLogo;
    doc.addImage(logoImg, 'PNG', pageWidth / 2 - 15, yPos, 30, 30);
    yPos += 35;
  } catch { yPos += 5; }

  // "Created by Admin" badge
  doc.setFillColor(41, 128, 185);
  doc.roundedRect(pageWidth / 2 - 30, yPos, 60, 8, 2, 2, 'F');
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(255, 255, 255);
  doc.text('ADMIN CREATED ORDER', pageWidth / 2, yPos + 5.5, { align: 'center' });
  yPos += 14;

  // Business info
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
    yPos += 6;
  }

  // Decorative line
  doc.setDrawColor(...primaryColor);
  doc.setLineWidth(1);
  doc.line(40, yPos, pageWidth - 40, yPos);
  yPos += 10;

  // Title
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...darkGray);
  doc.text('ORDER INVOICE', pageWidth / 2, yPos, { align: 'center' });
  yPos += 12;

  // Order details box
  const boxX = 15;
  const boxWidth = pageWidth - 30;
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(boxX, yPos, boxWidth, 22, 2, 2, 'F');
  yPos += 7;
  doc.setFontSize(10);
  doc.setTextColor(...darkGray);
  doc.setFont('helvetica', 'bold');
  doc.text('Order #:', boxX + 7, yPos);
  doc.setFont('helvetica', 'normal');
  doc.text(order.order_number, boxX + 28, yPos);

  doc.setFont('helvetica', 'bold');
  doc.text('Date:', pageWidth / 2 + 5, yPos);
  doc.setFont('helvetica', 'normal');
  const formattedDate = new Date(order.created_at).toLocaleDateString('en-GB', {
    day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit'
  });
  doc.text(formattedDate, pageWidth / 2 + 20, yPos);
  yPos += 7;

  doc.setFont('helvetica', 'bold');
  doc.text('Payment:', boxX + 7, yPos);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(234, 179, 8);
  doc.text('PENDING - BANK TRANSFER', boxX + 28, yPos);
  doc.setTextColor(...darkGray);
  yPos += 12;

  // Customer Information
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('CUSTOMER INFORMATION', 15, yPos);
  yPos += 8;

  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);
  if (order.customer_name) { doc.setFont('helvetica', 'bold'); doc.text('Name:', 15, yPos); doc.setFont('helvetica', 'normal'); doc.text(order.customer_name, 35, yPos); yPos += 6; }
  if (order.customer_email) { doc.setFont('helvetica', 'bold'); doc.text('Email:', 15, yPos); doc.setFont('helvetica', 'normal'); doc.text(order.customer_email, 35, yPos); yPos += 6; }
  if (order.customer_phone) { doc.setFont('helvetica', 'bold'); doc.text('Phone:', 15, yPos); doc.setFont('helvetica', 'normal'); doc.text(order.customer_phone, 35, yPos); yPos += 6; }
  yPos += 4;

  // 🏦 PAYMENT INSTRUCTIONS (Virtual Account)
  if (virtualAccount) {
    doc.setFillColor(240, 248, 255);
    doc.setDrawColor(...blueAccent);
    doc.setLineWidth(0.5);
    const paymentBoxY = yPos;
    doc.roundedRect(15, paymentBoxY, pageWidth - 30, 48, 3, 3, 'FD');
    yPos += 8;

    doc.setFontSize(13);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...blueAccent);
    doc.text('PAYMENT INSTRUCTIONS', 20, yPos);
    yPos += 8;

    doc.setFontSize(11);
    doc.setTextColor(...darkGray);
    doc.setFont('helvetica', 'normal');
    doc.text('Transfer the exact amount below to complete your order:', 20, yPos);
    yPos += 8;

    doc.setFont('helvetica', 'bold');
    doc.text('Bank:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(virtualAccount.bank_name, 55, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Account No:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(13);
    doc.text(virtualAccount.account_number, 55, yPos);
    doc.setFontSize(11);
    yPos += 6;

    doc.setFont('helvetica', 'bold');
    doc.text('Account Name:', 20, yPos);
    doc.setFont('helvetica', 'normal');
    doc.text(virtualAccount.account_name, 55, yPos);
    yPos += 6;

    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...primaryColor);
    doc.text(`Amount: ${formatCurrency(order.total_amount)}`, 20, yPos);
    doc.setTextColor(...darkGray);
    yPos += 10;
  }

  yPos += 4;

  // Items table
  doc.setFontSize(12);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('ORDER ITEMS', 15, yPos);
  yPos += 8;

  const items = order.items || order.order_items || [];
  const tableData = items.map((item) => {
    const productName = item.product_name || item.name || 'Item';
    const unitPrice = item.unit_price || item.price || 0;
    const totalPrice = item.total_price || (item.quantity * unitPrice);
    return [productName, item.quantity.toString(), formatCurrency(unitPrice), formatCurrency(totalPrice)];
  });

  autoTable(doc, {
    startY: yPos,
    head: [['Item', 'Qty', 'Unit Price', 'Total']],
    body: tableData,
    theme: 'grid',
    headStyles: { fillColor: primaryColor, textColor: [255, 255, 255], fontStyle: 'bold', fontSize: 10, cellPadding: 5 },
    bodyStyles: { fontSize: 11, cellPadding: 5, textColor: darkGray },
    alternateRowStyles: { fillColor: [250, 250, 250] },
    columnStyles: {
      0: { cellWidth: 'auto' },
      1: { cellWidth: 20, halign: 'center' },
      2: { cellWidth: 45, halign: 'right' },
      3: { cellWidth: 45, halign: 'right', fontStyle: 'bold' }
    },
    margin: { left: 15, right: 15 }
  });

  yPos = (doc as any).lastAutoTable.finalY + 15;

  // Totals
  const summaryBoxX = pageWidth - 85;
  doc.setFillColor(250, 250, 250);
  doc.roundedRect(summaryBoxX, yPos, 70, 40, 2, 2, 'F');
  const summaryX = summaryBoxX + 5;
  yPos += 7;
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...darkGray);

  if (order.subtotal !== undefined) {
    doc.text('Subtotal:', summaryX, yPos);
    doc.text(formatCurrency(order.subtotal), pageWidth - 20, yPos, { align: 'right' });
    yPos += 6;
  }
  if (order.delivery_fee) {
    doc.text('Delivery Fee:', summaryX, yPos);
    doc.text(formatCurrency(order.delivery_fee), pageWidth - 20, yPos, { align: 'right' });
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
  doc.text(formatCurrency(order.total_amount), pageWidth - 20, yPos, { align: 'right' });

  // Footer
  const footerY = pageHeight - 25;
  doc.setFontSize(11);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...primaryColor);
  doc.text('Thank you for your order!', pageWidth / 2, footerY, { align: 'center' });
  
  doc.setFontSize(8);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...lightGray);
  doc.text(`Generated on ${new Date().toLocaleString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })}`, pageWidth / 2, footerY + 6, { align: 'center' });
  doc.setDrawColor(...lightGray);
  doc.setLineWidth(0.3);
  doc.line(40, footerY + 10, pageWidth - 40, footerY + 10);
  doc.setFontSize(7);
  doc.text('This is a computer-generated invoice. Payment via bank transfer to the account above.', pageWidth / 2, footerY + 14, { align: 'center' });

  doc.save(`Invoice-${order.order_number}.pdf`);
};
