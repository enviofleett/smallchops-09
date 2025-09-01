/**
 * Error Test Component - Development Only
 * Used to test error boundary functionality
 */

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Bug, Clock, Wifi, ShieldAlert } from 'lucide-react';

interface ErrorTestProps {
  onError?: (error: Error) => void;
}

export const ErrorTestComponent: React.FC<ErrorTestProps> = ({ onError }) => {
  const [shouldThrow, setShouldThrow] = useState('');

  // Only show in development
  if (import.meta.env.PROD) {
    return null;
  }

  const triggerError = (errorType: string) => {
    const error = new Error(`Test ${errorType} error`);
    
    switch (errorType) {
      case 'timeout':
        error.message = 'Component load timeout after 30000ms';
        break;
      case 'network':
        error.message = 'Network request failed: fetch error';
        break;
      case 'chunk':
        error.message = 'Loading chunk 5 failed';
        break;
      case 'runtime':
        error.message = 'Cannot read property "test" of undefined';
        break;
      default:
        error.message = 'Generic test error';
    }
    
    onError?.(error);
    setShouldThrow(errorType);
  };

  // Throw error after state update
  if (shouldThrow) {
    setShouldThrow(''); // Reset state
    throw new Error(`Test ${shouldThrow} error`);
  }

  return (
    <Card className="border-dashed border-orange-300 bg-orange-50 dark:bg-orange-950/20">
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-orange-700 dark:text-orange-300">
          <Bug className="h-5 w-5" />
          Error Boundary Testing (Dev Only)
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerError('timeout')}
            className="flex items-center gap-2 text-xs"
          >
            <Clock className="h-3 w-3" />
            Timeout Error
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerError('network')}
            className="flex items-center gap-2 text-xs"
          >
            <Wifi className="h-3 w-3" />
            Network Error
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerError('chunk')}
            className="flex items-center gap-2 text-xs"
          >
            <ShieldAlert className="h-3 w-3" />
            Chunk Error
          </Button>
          
          <Button
            variant="outline"
            size="sm"
            onClick={() => triggerError('runtime')}
            className="flex items-center gap-2 text-xs"
          >
            <Bug className="h-3 w-3" />
            Runtime Error
          </Button>
        </div>
        
        <p className="text-xs text-orange-600 dark:text-orange-400">
          Click any button to test the error boundary handling for different error types.
        </p>
      </CardContent>
    </Card>
  );
};