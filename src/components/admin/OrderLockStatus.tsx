import React from 'react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';
import { useLockCountdown } from '@/hooks/useLockCountdown';
import { Lock, LockOpen, Clock, User } from 'lucide-react';

interface LockInfo {
  is_locked: boolean;
  locking_admin_id?: string;
  locking_admin_name?: string;
  locking_admin_avatar?: string;
  locking_admin_email?: string;
  lock_expires_at?: string;
  seconds_remaining?: number;
  acquired_at?: string;
}

interface OrderLockStatusProps {
  orderId: string;
  lockInfo: LockInfo;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

export const OrderLockStatus: React.FC<OrderLockStatusProps> = ({
  orderId,
  lockInfo,
  className = '',
  size = 'md'
}) => {
  const { timeRemaining, isExpired } = useLockCountdown({
    expiresAt: lockInfo.lock_expires_at,
    isLocked: lockInfo.is_locked
  });

  const formatTimeRemaining = (seconds: number) => {
    if (seconds <= 0) return '0:00';
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  const sizeClasses = {
    sm: 'text-xs gap-1',
    md: 'text-sm gap-2', 
    lg: 'text-base gap-3'
  };

  const avatarSizes = {
    sm: 'h-6 w-6',
    md: 'h-8 w-8',
    lg: 'h-10 w-10'
  };

  const iconSizes = {
    sm: 'h-3 w-3',
    md: 'h-4 w-4',
    lg: 'h-5 w-5'
  };

  if (!lockInfo.is_locked || isExpired) {
    return (
      <div className={`flex items-center ${sizeClasses[size]} text-muted-foreground ${className}`}>
        <LockOpen className={iconSizes[size]} />
        <span>Available</span>
      </div>
    );
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <div className={`flex items-center ${sizeClasses[size]} ${className}`}>
            <div className="flex items-center gap-2">
              <Avatar className={avatarSizes[size]}>
                <AvatarImage src={lockInfo.locking_admin_avatar || undefined} />
                <AvatarFallback className="bg-primary/10 text-primary">
                  {lockInfo.locking_admin_name?.charAt(0)?.toUpperCase() || <User className={iconSizes[size]} />}
                </AvatarFallback>
              </Avatar>
              
              <div className="flex flex-col">
                <div className="flex items-center gap-1">
                  <Lock className={`${iconSizes[size]} text-warning`} />
                  <span className="font-medium text-warning">
                    Locked by {lockInfo.locking_admin_name || 'Admin'}
                  </span>
                </div>
                
                <div className="flex items-center gap-1 text-muted-foreground">
                  <Clock className={iconSizes[size]} />
                  <span className="tabular-nums">
                    {formatTimeRemaining(timeRemaining)}
                  </span>
                </div>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        
        <TooltipContent>
          <div className="space-y-2">
            <div className="font-medium">Order Lock Details</div>
            <div className="space-y-1 text-sm">
              <div>Admin: {lockInfo.locking_admin_name}</div>
              <div>Email: {lockInfo.locking_admin_email}</div>
              <div>Time remaining: {formatTimeRemaining(timeRemaining)}</div>
              {lockInfo.acquired_at && (
                <div>Acquired: {new Date(lockInfo.acquired_at).toLocaleTimeString()}</div>
              )}
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};