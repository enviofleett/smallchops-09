import React, { useRef, useCallback, useState, useEffect } from 'react';
import HCaptcha from '@hcaptcha/react-hcaptcha';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CaptchaComponentProps {
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  className?: string;
  disabled?: boolean;
  size?: 'normal' | 'compact';
  theme?: 'light' | 'dark';
  showRetry?: boolean;
  required?: boolean;
}

export const CaptchaComponent = ({
  onVerify,
  onError,
  onExpire,
  className,
  disabled = false,
  size = 'normal',
  theme = 'light',
  showRetry = true,
  required = false
}: CaptchaComponentProps) => {
  const captchaRef = useRef<HCaptcha>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [retryCount, setRetryCount] = useState(0);
  const [isExpired, setIsExpired] = useState(false);

  // Import production CAPTCHA config
  const HCAPTCHA_SITE_KEY = '10000000-ffff-ffff-ffff-000000000001'; // Demo key - replace with production key

  const handleVerify = useCallback((token: string) => {
    setCaptchaError(null);
    setIsExpired(false);
    setIsLoading(false);
    onVerify(token);
  }, [onVerify]);

  const handleError = useCallback((error: string) => {
    console.error('CAPTCHA Error:', error);
    setCaptchaError(error);
    setIsLoading(false);
    onError?.(error);
  }, [onError]);

  const handleExpire = useCallback(() => {
    setIsExpired(true);
    setCaptchaError('CAPTCHA expired. Please verify again.');
    onExpire?.();
  }, [onExpire]);

  const handleRetry = useCallback(() => {
    setCaptchaError(null);
    setIsExpired(false);
    setRetryCount(prev => prev + 1);
    captchaRef.current?.resetCaptcha();
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  useEffect(() => {
    if (disabled) {
      captchaRef.current?.resetCaptcha();
    }
  }, [disabled]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* CAPTCHA Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>Security Verification{required && ' *'}</span>
      </div>

      {/* CAPTCHA Widget */}
      <div className="flex flex-col items-center space-y-3">
        <div className={cn(
          "relative",
          isLoading && "opacity-50",
          disabled && "pointer-events-none opacity-30"
        )}>
          <HCaptcha
            ref={captchaRef}
            sitekey={HCAPTCHA_SITE_KEY}
            onVerify={handleVerify}
            onError={handleError}
            onExpire={handleExpire}
            onLoad={handleLoad}
            size={size}
            theme={theme}
            tabIndex={disabled ? -1 : 0}
          />
          
          {isLoading && (
            <div className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded">
              <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            </div>
          )}
        </div>

        {/* Error Display */}
        {captchaError && (
          <Alert variant="destructive" className="w-full max-w-sm">
            <AlertTriangle className="h-4 w-4" />
            <AlertDescription className="text-sm">
              {captchaError}
            </AlertDescription>
          </Alert>
        )}

        {/* Retry Button */}
        {showRetry && (captchaError || isExpired) && !disabled && (
          <Button
            variant="outline"
            size="sm"
            onClick={handleRetry}
            className="flex items-center gap-2"
          >
            <RefreshCw className="h-3 w-3" />
            Retry Verification
            {retryCount > 0 && (
              <span className="text-xs text-muted-foreground">
                ({retryCount + 1})
              </span>
            )}
          </Button>
        )}
      </div>

      {/* Helper Text */}
      <p className="text-xs text-muted-foreground text-center">
        This helps protect against automated abuse.
      </p>
    </div>
  );
};

export default CaptchaComponent;