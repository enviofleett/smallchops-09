import React, { Suspense, Component, ReactNode } from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Card, CardContent } from '@/components/ui/card';
import { Loader2, RefreshCw } from 'lucide-react';
import { Button } from '@/components/ui/button';

interface ProductionTrackingWrapperProps {
  children: React.ReactNode;
}

interface ErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

class TrackingErrorBoundary extends Component<
  { children: ReactNode; onError?: (error: Error, errorInfo: any) => void },
  ErrorBoundaryState
> {
  constructor(props: { children: ReactNode; onError?: (error: Error, errorInfo: any) => void }) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: any) {
    console.error('[TRACK] Component error boundary triggered:', error);
    this.props.onError?.(error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return (
        <Card className="border-red-200 bg-red-50">
          <CardContent className="pt-6">
            <Alert className="border-red-200">
              <AlertDescription>
                <div className="space-y-4">
                  <div>
                    <h3 className="font-semibold text-red-800">Tracking Service Temporarily Unavailable</h3>
                    <p className="text-red-700 mt-1">
                      We're experiencing technical difficulties with our tracking system. 
                      Please try again in a moment.
                    </p>
                  </div>
                  
                  <div className="flex gap-2">
                    <Button 
                      onClick={() => this.setState({ hasError: false })} 
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      <RefreshCw className="w-4 h-4 mr-2" />
                      Try Again
                    </Button>
                    <Button 
                      onClick={() => window.location.reload()} 
                      variant="outline"
                      size="sm"
                      className="border-red-300 text-red-700 hover:bg-red-100"
                    >
                      Refresh Page
                    </Button>
                  </div>
                </div>
              </AlertDescription>
            </Alert>
          </CardContent>
        </Card>
      );
    }

    return this.props.children;
  }
}

function TrackingLoader() {
  return (
    <Card>
      <CardContent className="pt-6">
        <div className="flex items-center justify-center py-8">
          <div className="text-center">
            <Loader2 className="w-8 h-8 mx-auto animate-spin text-primary mb-2" />
            <p className="text-muted-foreground">Loading tracking system...</p>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export const ProductionTrackingWrapper: React.FC<ProductionTrackingWrapperProps> = ({ 
  children 
}) => {
  return (
    <TrackingErrorBoundary
      onError={(error, errorInfo) => {
        // In production, you might want to send this to an error reporting service
        console.error('[TRACK] Error boundary caught error:', {
          error: error.message,
          stack: error.stack,
          errorInfo,
          timestamp: new Date().toISOString(),
          userAgent: navigator.userAgent,
          url: window.location.href
        });
      }}
    >
      <Suspense fallback={<TrackingLoader />}>
        {children}
      </Suspense>
    </TrackingErrorBoundary>
  );
};