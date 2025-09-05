import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Card, CardContent } from '@/components/ui/card';
import { CalendarIcon, Clock, Loader2 } from 'lucide-react';

interface LoadingProgressProps {
  progress: number;
  message?: string;
  showIcon?: boolean;
}

export const LoadingProgress: React.FC<LoadingProgressProps> = ({ 
  progress, 
  message = "Loading delivery schedules...", 
  showIcon = true 
}) => {
  const getProgressMessage = (progress: number) => {
    if (progress < 20) return "Initializing delivery system...";
    if (progress < 50) return "Fetching available time slots...";
    if (progress < 80) return "Processing delivery data...";
    if (progress < 100) return "Finalizing schedule options...";
    return "Complete!";
  };

  const displayMessage = message || getProgressMessage(progress);

  return (
    <Card className="p-6 border-primary/20 bg-gradient-to-br from-primary/5 to-primary/10">
      <CardContent className="flex flex-col items-center justify-center space-y-4 p-0">
        {showIcon && (
          <div className="relative">
            <CalendarIcon className="h-12 w-12 text-primary/30" />
            <Loader2 className="h-6 w-6 text-primary animate-spin absolute top-3 left-3" />
          </div>
        )}
        
        <div className="text-center space-y-3 w-full max-w-sm">
          <h3 className="text-lg font-semibold text-foreground flex items-center justify-center gap-2">
            <Clock className="h-5 w-5 text-primary animate-pulse" />
            Delivery Scheduling
          </h3>
          
          <Progress 
            value={progress} 
            className="w-full h-3 bg-primary/20" 
          />
          
          <div className="space-y-1">
            <p className="text-sm font-medium text-primary">
              {displayMessage}
            </p>
            <p className="text-xs text-muted-foreground">
              {progress}% complete
            </p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
};

export default LoadingProgress;