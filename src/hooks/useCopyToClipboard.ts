import { useState, useCallback } from 'react';
import { toast } from 'sonner';
import { CopyToClipboardResult } from '@/types/orderDetailsModal';

interface UseCopyToClipboardReturn {
  copyToClipboard: (value: string, successMessage?: string) => Promise<CopyToClipboardResult>;
  isCopying: boolean;
  lastCopied: string | null;
}

export const useCopyToClipboard = (): UseCopyToClipboardReturn => {
  const [isCopying, setIsCopying] = useState(false);
  const [lastCopied, setLastCopied] = useState<string | null>(null);

  const copyToClipboard = useCallback(async (
    value: string, 
    successMessage: string = 'Copied to clipboard'
  ): Promise<CopyToClipboardResult> => {
    if (!value) {
      const result = { success: false, message: 'Nothing to copy' };
      toast.error(result.message);
      return result;
    }

    setIsCopying(true);

    try {
      // Modern clipboard API
      if (navigator.clipboard && window.isSecureContext) {
        await navigator.clipboard.writeText(value);
      } else {
        // Fallback for older browsers or non-secure contexts
        const textArea = document.createElement('textarea');
        textArea.value = value;
        textArea.style.position = 'fixed';
        textArea.style.left = '-9999px';
        textArea.style.top = '-9999px';
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        
        const successful = document.execCommand('copy');
        document.body.removeChild(textArea);
        
        if (!successful) {
          throw new Error('Fallback copy failed');
        }
      }

      setLastCopied(value);
      toast.success(successMessage);
      return { success: true, message: successMessage };

    } catch (error) {
      console.error('Copy to clipboard failed:', error);
      const errorMessage = 'Failed to copy to clipboard';
      toast.error(errorMessage);
      return { success: false, message: errorMessage };
    } finally {
      setIsCopying(false);
    }
  }, []);

  return {
    copyToClipboard,
    isCopying,
    lastCopied,
  };
};