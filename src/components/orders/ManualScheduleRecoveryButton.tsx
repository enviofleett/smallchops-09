import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { RefreshCw } from 'lucide-react';
import { useOrderScheduleRecovery } from '@/hooks/useOrderScheduleRecovery';
import { useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';

interface ManualScheduleRecoveryButtonProps {
  orderId: string;
  onSuccess?: () => void;
}

/**
 * Manual recovery button to replace problematic auto-recovery
 */
export const ManualScheduleRecoveryButton = ({ orderId, onSuccess }: ManualScheduleRecoveryButtonProps) => {
  const [isRecovering, setIsRecovering] = useState(false);
  const { attemptScheduleRecovery } = useOrderScheduleRecovery();
  const queryClient = useQueryClient();

  const handleManualRecovery = async () => {
    setIsRecovering(true);
    try {
      console.log(`🔄 Manual schedule recovery initiated for order ${orderId}`);
      
      const result = await attemptScheduleRecovery(orderId);
      
      if (result) {
        // Invalidate queries to force refresh
        await queryClient.invalidateQueries({ queryKey: ['deliverySchedule', orderId] });
        
        toast.success('Delivery schedule has been recovered manually.');
        
        onSuccess?.();
      } else {
        toast.error('Could not recover delivery schedule. Please contact support.');
      }
    } catch (error) {
      console.error('❌ Manual recovery error:', error);
      toast.error('An error occurred during manual recovery.');
    } finally {
      setIsRecovering(false);
    }
  };

  return (
    <Button
      onClick={handleManualRecovery}
      disabled={isRecovering}
      variant="outline"
      size="sm"
      className="flex items-center gap-2"
    >
      <RefreshCw className={`w-4 h-4 ${isRecovering ? 'animate-spin' : ''}`} />
      {isRecovering ? 'Recovering...' : 'Recover Schedule'}
    </Button>
  );
};