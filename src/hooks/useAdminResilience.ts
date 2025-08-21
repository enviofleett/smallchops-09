import { UseQueryResult } from '@tanstack/react-query';
import { useToast } from '@/hooks/use-toast';
import { useNetworkResilience } from '@/hooks/useNetworkResilience';
import { useEffect } from 'react';

interface AdminResilienceOptions<T> {
  fallbackData?: T;
  onError?: (error: Error) => void;
  showToast?: boolean;
  pageContext?: string;
}

export const useAdminResilience = <T>(
  queryResult: UseQueryResult<T>,
  options: AdminResilienceOptions<T> = {}
) => {
  const { toast } = useToast();
  const { pageContext = 'Admin Dashboard' } = options;

  // Apply network resilience first
  const resilientResult = useNetworkResilience(queryResult, {
    ...options,
    showToast: false, // We'll handle toasts ourselves for admin context
  });

  // Enhanced error handling for admin pages
  useEffect(() => {
    if (resilientResult.isError && resilientResult.error) {
      console.error(`${pageContext} error:`, resilientResult.error);
      
      if (options.showToast !== false) {
        toast({
          title: `${pageContext} Loading Issue`,
          description: "Some data may be outdated. The system is working to restore full functionality.",
          variant: "destructive",
          duration: 5000,
        });
      }
      
      options.onError?.(resilientResult.error);
    }
  }, [resilientResult.isError, resilientResult.error, options, toast, pageContext]);

  // Show loading states for admin with better UX
  if (resilientResult.isLoading && !resilientResult.data) {
    return {
      ...resilientResult,
      data: options.fallbackData,
      isLoading: true,
      isError: false,
    };
  }

  return resilientResult;
};

// Specialized hook for dashboard components
export const useDashboardResilience = <T>(
  queryResult: UseQueryResult<T>,
  options: Omit<AdminResilienceOptions<T>, 'pageContext'> = {}
) => {
  return useAdminResilience(queryResult, {
    ...options,
    pageContext: 'Dashboard'
  });
};

// Specialized hook for admin reports
export const useReportsResilience = <T>(
  queryResult: UseQueryResult<T>,
  options: Omit<AdminResilienceOptions<T>, 'pageContext'> = {}
) => {
  return useAdminResilience(queryResult, {
    ...options,
    pageContext: 'Reports'
  });
};