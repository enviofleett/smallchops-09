import React from 'react';
import { Progress } from '@/components/ui/progress';
import { Loader2, CheckCircle, AlertCircle, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

interface UploadProgressProps {
  status: 'idle' | 'processing' | 'uploading' | 'success' | 'error';
  progress?: number;
  error?: string;
  onRetry?: () => void;
  onCancel?: () => void;
  className?: string;
}

export const UploadProgress = ({ 
  status, 
  progress = 0, 
  error, 
  onRetry, 
  onCancel,
  className 
}: UploadProgressProps) => {
  const getStatusConfig = () => {
    switch (status) {
      case 'processing':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: 'Processing image...',
          description: 'Optimizing and resizing your image',
          color: 'text-blue-600'
        };
      case 'uploading':
        return {
          icon: <Loader2 className="h-4 w-4 animate-spin" />,
          text: 'Uploading...',
          description: `${Math.round(progress)}% complete`,
          color: 'text-blue-600'
        };
      case 'success':
        return {
          icon: <CheckCircle className="h-4 w-4" />,
          text: 'Upload successful!',
          description: 'Your image has been uploaded',
          color: 'text-green-600'
        };
      case 'error':
        return {
          icon: <AlertCircle className="h-4 w-4" />,
          text: 'Upload failed',
          description: error || 'An error occurred during upload',
          color: 'text-red-600'
        };
      default:
        return null;
    }
  };

  const config = getStatusConfig();
  if (!config || status === 'idle') return null;

  return (
    <div className={cn("border rounded-lg p-4 bg-muted/30", className)}>
      <div className="flex items-center gap-3">
        <div className={cn("flex-shrink-0", config.color)}>
          {config.icon}
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center justify-between">
            <p className={cn("text-sm font-medium", config.color)}>
              {config.text}
            </p>
            {status === 'error' && onCancel && (
              <Button
                variant="ghost"
                size="sm"
                onClick={onCancel}
                className="h-6 w-6 p-0"
              >
                ×
              </Button>
            )}
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {config.description}
          </p>
          
          {(status === 'processing' || status === 'uploading') && (
            <Progress 
              value={status === 'uploading' ? progress : undefined} 
              className="mt-2 h-1"
            />
          )}
          
          {status === 'error' && onRetry && (
            <Button
              variant="outline"
              size="sm"
              onClick={onRetry}
              className="mt-2 h-7 text-xs"
            >
              <RefreshCw className="h-3 w-3 mr-1" />
              Try Again
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};