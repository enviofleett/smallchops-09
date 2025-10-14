import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { generateCustomerReceiptPDF } from '@/utils/customerReceiptPDF';

interface BusinessInfo {
  name: string;
  address?: string;
  phone?: string;
  email?: string;
}

export const useCustomerReceiptPDF = () => {
  const [isGenerating, setIsGenerating] = useState(false);

  const downloadReceipt = useCallback(async (order: any, businessInfo?: BusinessInfo) => {
    if (!order) {
      toast.error('No order data available');
      return;
    }

    if (!order.order_number) {
      toast.error('Invalid order: missing order number');
      return;
    }

    setIsGenerating(true);

    try {
      // Add a small delay to show loading state
      await new Promise(resolve => setTimeout(resolve, 300));

      generateCustomerReceiptPDF(order, businessInfo);

      toast.success(`Receipt downloaded: ${order.order_number}`);
    } catch (error) {
      console.error('PDF generation error:', error);
      toast.error('Failed to generate receipt. Please try again.');
    } finally {
      setIsGenerating(false);
    }
  }, []);

  return {
    downloadReceipt,
    isGenerating,
  };
};
