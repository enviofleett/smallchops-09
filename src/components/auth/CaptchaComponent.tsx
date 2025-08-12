import React, { useRef, useCallback, useState, useEffect } from 'react';
import { Turnstile } from '@marsidev/react-turnstile';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Shield, AlertTriangle, RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { CAPTCHA_CONFIG, getCaptchaSiteKey } from '@/config/captcha';

interface CaptchaComponentProps {
  onVerify: (token: string) => void;
  onError?: (error: string) => void;
  onExpire?: () => void;
  className?: string;
  disabled?: boolean;
  size?: 'normal' | 'compact';
  theme?: 'light' | 'dark' | 'auto';
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
  theme = 'auto',
  showRetry = true,
  required = false
}: CaptchaComponentProps) => {
  const turnstileRef = useRef<any>(null);
  const [captchaError, setCaptchaError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [retryCount, setRetryCount] = useState(0);
  const [isExpired, setIsExpired] = useState(false);
  const [siteKey, setSiteKey] = useState<string>(CAPTCHA_CONFIG.SITE_KEY);

  // Load production site key on mount
  useEffect(() => {
    const loadSiteKey = async () => {
      try {
        const key = await getCaptchaSiteKey();
        setSiteKey(key);
        console.log('Turnstile site key loaded:', key);
      } catch (error) {
        console.warn('Failed to load Turnstile site key:', error);
        // Keep default demo key
      }
    };
    loadSiteKey();
  }, []);

  const handleSuccess = useCallback((token: string) => {
    setCaptchaError(null);
    setIsExpired(false);
    setIsLoading(false);
    onVerify(token);
  }, [onVerify]);

  const handleError = useCallback((error: string) => {
    console.error('Turnstile Error:', error);
    
    // Map Turnstile error codes to user-friendly messages
    let errorMessage: string;
    
    switch (error) {
      case 'network-error':
        errorMessage = CAPTCHA_CONFIG.ERRORS.NETWORK_ERROR;
        break;
      case 'timeout-or-duplicate':
        errorMessage = CAPTCHA_CONFIG.ERRORS.CHALLENGE_TIMEOUT;
        break;
      case 'internal-error':
        errorMessage = CAPTCHA_CONFIG.ERRORS.INTERNAL_ERROR;
        break;
      case 'challenge-error':
        errorMessage = CAPTCHA_CONFIG.ERRORS.INVALID_RESPONSE;
        break;
      case 'rate-limited':
        errorMessage = CAPTCHA_CONFIG.ERRORS.RATE_LIMITED;
        break;
      default:
        errorMessage = CAPTCHA_CONFIG.ERRORS.GENERIC_CLIENT_ERROR;
    }
    
    setCaptchaError(errorMessage);
    setIsLoading(false);
    onError?.(errorMessage);
  }, [onError]);

  const handleExpire = useCallback(() => {
    setIsExpired(true);
    setCaptchaError(CAPTCHA_CONFIG.ERRORS.CHALLENGE_EXPIRED);
    onExpire?.();
  }, [onExpire]);

  const handleRetry = useCallback(() => {
    setCaptchaError(null);
    setIsExpired(false);
    setRetryCount(prev => prev + 1);
    setIsLoading(true);
    
    // Reset the Turnstile widget
    if (turnstileRef.current) {
      turnstileRef.current.reset();
    }
  }, []);

  const handleLoad = useCallback(() => {
    setIsLoading(false);
  }, []);

  // Reset when disabled
  useEffect(() => {
    if (disabled && turnstileRef.current) {
      turnstileRef.current.reset();
    }
  }, [disabled]);

  return (
    <div className={cn("space-y-3", className)}>
      {/* CAPTCHA Header */}
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Shield className="h-4 w-4" />
        <span>Security Verification{required && ' *'}</span>
      </div>

      {/* Turnstile Widget */}
      <div className="flex flex-col items-center space-y-3">
        <div className={cn(
          "relative w-full flex justify-center",
          isLoading && "opacity-50",
          disabled && "pointer-events-none opacity-30"
        )}>
          <Turnstile
            ref={turnstileRef}
            siteKey={siteKey}
            onSuccess={handleSuccess}
            onError={handleError}
            onExpire={handleExpire}
            onLoad={handleLoad}
            options={{
              theme: theme as any,
              size: size as any,
              appearance: CAPTCHA_CONFIG.UI.APPEARANCE as any,
              language: CAPTCHA_CONFIG.PERFORMANCE.LANGUAGE,
            }}
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
        Protected by Cloudflare Turnstile. This helps protect against automated abuse.
      </p>
    </div>
  );
};

export default CaptchaComponent;
