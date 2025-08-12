import { useState, useCallback, useRef } from 'react';
import { useToast } from '@/hooks/use-toast';

interface CaptchaState {
  token: string | null;
  isVerified: boolean;
  isRequired: boolean;
  attempts: number;
  lastAttempt: number | null;
}

interface CaptchaConfig {
  requiredAfterAttempts?: number;
  maxAttempts?: number;
  cooldownPeriod?: number; // in milliseconds
  autoReset?: boolean;
}

export const useCaptcha = (config: CaptchaConfig = {}) => {
  const {
    requiredAfterAttempts = 3,
    maxAttempts = 5,
    cooldownPeriod = 60000, // 1 minute
    autoReset = true
  } = config;

  const { toast } = useToast();
  const attemptsRef = useRef(0);
  const lastAttemptRef = useRef<number | null>(null);
  
  const [captchaState, setCaptchaState] = useState<CaptchaState>({
    token: null,
    isVerified: false,
    isRequired: false,
    attempts: 0,
    lastAttempt: null
  });

  const shouldRequireCaptcha = useCallback(() => {
    const now = Date.now();
    
    // Only require CAPTCHA if there have been actual failed attempts
    if (attemptsRef.current === 0) return false;
    
    // Check if we're in cooldown period
    if (lastAttemptRef.current && (now - lastAttemptRef.current) < cooldownPeriod) {
      return true;
    }
    
    // Require CAPTCHA after failed attempts
    return attemptsRef.current >= requiredAfterAttempts;
  }, [requiredAfterAttempts, cooldownPeriod]);

  const recordFailedAttempt = useCallback(() => {
    attemptsRef.current += 1;
    lastAttemptRef.current = Date.now();
    
    setCaptchaState(prev => ({
      ...prev,
      attempts: attemptsRef.current,
      lastAttempt: lastAttemptRef.current,
      isRequired: shouldRequireCaptcha(),
      // Reset verification on failed attempt
      token: null,
      isVerified: false
    }));

    // Show warning when approaching CAPTCHA requirement
    if (attemptsRef.current === requiredAfterAttempts - 1) {
      toast({
        title: "Security Notice",
        description: "One more failed attempt will require CAPTCHA verification.",
        variant: "destructive"
      });
    } else if (attemptsRef.current >= requiredAfterAttempts) {
      toast({
        title: "CAPTCHA Required",
        description: "Please complete the security verification to continue.",
        variant: "destructive"
      });
    }

    // Block further attempts if max reached
    if (attemptsRef.current >= maxAttempts) {
      const waitTime = Math.ceil(cooldownPeriod / 60000);
      toast({
        title: "Too Many Attempts",
        description: `Please wait ${waitTime} minute(s) before trying again.`,
        variant: "destructive"
      });
    }
  }, [shouldRequireCaptcha, requiredAfterAttempts, maxAttempts, cooldownPeriod, toast]);

  const recordSuccessfulAttempt = useCallback(() => {
    if (autoReset) {
      // Reset on successful login
      attemptsRef.current = 0;
      lastAttemptRef.current = null;
      
      setCaptchaState({
        token: null,
        isVerified: false,
        isRequired: false,
        attempts: 0,
        lastAttempt: null
      });
    }
  }, [autoReset]);

  const verifyCaptcha = useCallback((token: string) => {
    setCaptchaState(prev => ({
      ...prev,
      token,
      isVerified: true
    }));
  }, []);

  const resetCaptcha = useCallback(() => {
    setCaptchaState(prev => ({
      ...prev,
      token: null,
      isVerified: false
    }));
  }, []);

  const forceReset = useCallback(() => {
    attemptsRef.current = 0;
    lastAttemptRef.current = null;
    setCaptchaState({
      token: null,
      isVerified: false,
      isRequired: false,
      attempts: 0,
      lastAttempt: null
    });
  }, []);

  const isBlocked = useCallback(() => {
    if (!lastAttemptRef.current) return false;
    
    const now = Date.now();
    const timeSinceLastAttempt = now - lastAttemptRef.current;
    
    return attemptsRef.current >= maxAttempts && timeSinceLastAttempt < cooldownPeriod;
  }, [maxAttempts, cooldownPeriod]);

  const getTimeUntilUnblock = useCallback(() => {
    if (!lastAttemptRef.current || !isBlocked()) return 0;
    
    const now = Date.now();
    const timeRemaining = cooldownPeriod - (now - lastAttemptRef.current);
    return Math.max(0, Math.ceil(timeRemaining / 1000));
  }, [cooldownPeriod, isBlocked]);

  return {
    // State
    captchaToken: captchaState.token,
    isCaptchaVerified: captchaState.isVerified,
    isCaptchaRequired: shouldRequireCaptcha(),
    attemptCount: attemptsRef.current,
    isBlocked: isBlocked(),
    timeUntilUnblock: getTimeUntilUnblock(),
    
    // Actions
    recordFailedAttempt,
    recordSuccessfulAttempt,
    verifyCaptcha,
    resetCaptcha,
    forceReset,
    
    // Utilities
    canAttemptLogin: !isBlocked(),
    needsCaptcha: shouldRequireCaptcha()
  };
};