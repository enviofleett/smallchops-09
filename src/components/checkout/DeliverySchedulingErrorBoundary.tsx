import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { AlertTriangle, RefreshCw } from 'lucide-react';

interface DeliverySchedulingErrorBoundaryProps {
  children: React.ReactNode;
}

interface DeliverySchedulingErrorBoundaryState {
  hasError: boolean;
  error?: Error;
}

export class DeliverySchedulingErrorBoundary extends React.Component<
  DeliverySchedulingErrorBoundaryProps,
  DeliverySchedulingErrorBoundaryState
> {
  constructor(props: DeliverySchedulingErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(error: Error): DeliverySchedulingErrorBoundaryState {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    console.error('Delivery scheduling error:', error, errorInfo);
  }

  handleRetry = () => {
    this.setState({ hasError: false, error: undefined });
  };

  render() {
    if (this.state.hasError) {
      return (
        <Alert variant="destructive">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="flex items-center justify-between">
            <span>Failed to load delivery scheduling. Please try again.</span>
            <Button
              variant="outline"
              size="sm"
              onClick={this.handleRetry}
              className="ml-2"
            >
              <RefreshCw className="h-4 w-4 mr-1" />
              Retry
            </Button>
          </AlertDescription>
        </Alert>
      );
    }

    return this.props.children;
  }
}