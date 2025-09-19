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
            <div className="flex items-center gap-2 w-full">
              <div className="flex items-center gap-2">
                <Avatar className={avatarSizes[size]}>
                  <AvatarImage src={lockInfo.locking_admin_avatar || undefined} />
                  <AvatarFallback className="bg-primary/10 text-primary">
                    {lockInfo.locking_admin_name?.charAt(0)?.toUpperCase() || <User className={iconSizes[size]} />}
                  </AvatarFallback>
                </Avatar>
                
                <div className="flex flex-col flex-1 min-w-0">
                  <div className="flex items-center gap-1">
                    <Lock className={`${iconSizes[size]} text-warning animate-pulse`} />
                    <span className="font-semibold text-warning truncate">
                      {lockInfo.locking_admin_name || 'Admin'}
                    </span>
                  </div>
                  
                  <div className="flex items-center gap-1">
                    <Clock className={`${iconSizes[size]} text-muted-foreground`} />
                    <span className={`tabular-nums font-mono text-sm ${
                      timeRemaining <= 10 ? 'text-destructive font-bold animate-pulse' : 
                      timeRemaining <= 30 ? 'text-warning font-semibold' : 
                      'text-muted-foreground'
                    }`}>
                      {formatTimeRemaining(timeRemaining)}
                    </span>
                    <span className="text-xs text-muted-foreground">left</span>
                  </div>
                </div>
              </div>
              
              {/* Progress indicator */}
              <div className="flex flex-col items-end gap-1">
                <Badge variant={timeRemaining <= 10 ? 'destructive' : 'secondary'} className="text-xs">
                  Locked
                </Badge>
                <div className="w-12 h-1 bg-muted rounded-full overflow-hidden">
                  <div 
                    className={`h-full transition-all duration-1000 ease-linear ${
                      timeRemaining <= 10 ? 'bg-destructive' :
                      timeRemaining <= 30 ? 'bg-warning' : 
                      'bg-primary'
                    }`}
                    style={{ 
                      width: `${Math.max(5, (timeRemaining / 300) * 100)}%` // Assuming 5-minute max lock
                    }}
                  />
                </div>
              </div>
            </div>
          </div>
        </TooltipTrigger>
        
        <TooltipContent side="top" className="max-w-xs">
          <div className="space-y-2">
            <div className="font-semibold text-primary">🔒 Order Lock Details</div>
            <div className="space-y-1 text-sm">
              <div className="flex items-center gap-2">
                <User className="h-3 w-3" />
                <span className="font-medium">{lockInfo.locking_admin_name}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <span>📧</span>
                <span>{lockInfo.locking_admin_email}</span>
              </div>
              <div className="flex items-center gap-2 font-mono">
                <Clock className="h-3 w-3" />
                <span>⏱️ {formatTimeRemaining(timeRemaining)} remaining</span>
              </div>
              {lockInfo.acquired_at && (
                <div className="flex items-center gap-2 text-muted-foreground text-xs">
                  <span>🕐</span>
                  <span>Locked at {new Date(lockInfo.acquired_at).toLocaleTimeString()}</span>
                </div>
              )}
              <div className="pt-1 text-xs text-muted-foreground border-t">
                This order is currently being edited by another admin
              </div>
            </div>
          </div>
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
};