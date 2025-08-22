import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { handlePostLoginRedirect } from '@/utils/redirect';
import { Loader2, CheckCircle, XCircle, AlertCircle, Mail, RefreshCw } from 'lucide-react';

interface VerificationState {
  status: 'loading' | 'success' | 'error' | 'expired' | 'invalid';
  isResending: boolean;
  retryCount: number;
}

const EmailVerificationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [state, setState] = useState<VerificationState>({
    status: 'loading',
    isResending: false,
    retryCount: 0
  });

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      const type = searchParams.get('type');
      const email = searchParams.get('email');
      
      // Validate required parameters
      if (!token) {
        console.error('Email verification: Missing token parameter');
        setState(prev => ({ ...prev, status: 'invalid' }));
        return;
      }
      
      if (!type || type !== 'signup') {
        console.error('Email verification: Invalid or missing type parameter');
        setState(prev => ({ ...prev, status: 'invalid' }));
        return;
      }

      try {
        console.log('Starting email verification process...');
        
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'signup'
        });

        if (error) {
          console.error('Email verification error:', error);
          
          // Determine specific error type for better user experience
          if (error.message.includes('expired') || error.message.includes('invalid')) {
            setState(prev => ({ ...prev, status: 'expired' }));
          } else {
            setState(prev => ({ ...prev, status: 'error' }));
          }
          
          toast({
            title: "Verification failed",
            description: getErrorMessage(error.message),
            variant: "destructive"
          });
          return;
        }

        console.log('Email verification successful');
        setState(prev => ({ ...prev, status: 'success' }));
        
        toast({
          title: "Email verified!",
          description: "Your account has been successfully verified.",
        });

        // Redirect after a short delay using proper redirect handling
        setTimeout(() => {
          try {
            const redirectPath = handlePostLoginRedirect('customer');
            navigate(redirectPath);
          } catch (redirectError) {
            console.error('Redirect error:', redirectError);
            // Fallback to home page
            navigate('/');
          }
        }, 3000);
      } catch (error) {
        console.error('Verification error:', error);
        setState(prev => ({ ...prev, status: 'error' }));
        
        toast({
          title: "Verification failed",
          description: error instanceof Error ? error.message : "An unexpected error occurred",
          variant: "destructive"
        });
      }
    };

    verifyEmail();
  }, [searchParams, navigate, toast]);

  const getErrorMessage = (errorMessage: string): string => {
    if (errorMessage.includes('expired')) {
      return 'The verification link has expired. Please request a new one.';
    }
    if (errorMessage.includes('invalid')) {
      return 'The verification link is invalid or has already been used.';
    }
    if (errorMessage.includes('network') || errorMessage.includes('fetch')) {
      return 'Network error. Please check your connection and try again.';
    }
    return 'Verification failed. Please try again or contact support.';
  };

  const handleResendVerification = async () => {
    if (state.retryCount >= 3) {
      toast({
        title: "Too many attempts",
        description: "Please wait 10 minutes before requesting another verification email.",
        variant: "destructive"
      });
      return;
    }

    setState(prev => ({ ...prev, isResending: true }));
    
    try {
      const email = searchParams.get('email');
      if (!email) {
        toast({
          title: "Email required",
          description: "Please provide your email address to resend verification.",
          variant: "destructive"
        });
        return;
      }

      const { error } = await supabase.auth.resend({
        type: 'signup',
        email: email,
        options: {
          emailRedirectTo: `${window.location.origin}/auth/verify`
        }
      });

      if (error) {
        throw error;
      }

      setState(prev => ({ 
        ...prev, 
        retryCount: prev.retryCount + 1
      }));

      toast({
        title: "Verification email sent",
        description: "Please check your email for the new verification link.",
      });
    } catch (error: any) {
      console.error('Resend verification error:', error);
      
      let errorMessage = 'Please try again later.';
      if (error.message?.includes('rate limit') || error.message?.includes('too many')) {
        errorMessage = 'Please wait a few minutes before requesting another email.';
      } else if (error.message?.includes('not found')) {
        errorMessage = 'Email address not found. Please register first.';
      }
      
      toast({
        title: "Failed to resend",
        description: errorMessage,
        variant: "destructive"
      });
    } finally {
      setState(prev => ({ ...prev, isResending: false }));
    }
  };

  const handleRetry = () => {
    setState(prev => ({ ...prev, status: 'loading' }));
    window.location.reload();
  };

  const renderContent = () => {
    switch (state.status) {
      case 'loading':
        return (
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-orange-600" />
            <div>
              <h3 className="text-lg font-semibold">Verifying your email...</h3>
              <p className="text-muted-foreground">Please wait while we confirm your account.</p>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center space-y-4">
            <CheckCircle className="h-12 w-12 mx-auto text-green-600" />
            <div>
              <h3 className="text-lg font-semibold text-green-700">Email Verified!</h3>
              <p className="text-muted-foreground">
                Your account has been successfully verified. You'll be redirected to your dashboard shortly.
              </p>
            </div>
            <Button onClick={() => {
              try {
                const redirectPath = handlePostLoginRedirect('customer');
                navigate(redirectPath);
              } catch {
                navigate('/');
              }
            }} className="w-full">
              Continue to Dashboard
            </Button>
          </div>
        );

      case 'expired':
        return (
          <div className="text-center space-y-4">
            <AlertCircle className="h-12 w-12 mx-auto text-amber-600" />
            <div>
              <h3 className="text-lg font-semibold text-amber-700">Link Expired</h3>
              <p className="text-muted-foreground">
                The verification link has expired. Please request a new one.
              </p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={handleResendVerification} 
                disabled={state.isResending || state.retryCount >= 3}
                className="w-full"
              >
                {state.isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Send New Verification Email
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/auth')}
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          </div>
        );

      case 'invalid':
        return (
          <div className="text-center space-y-4">
            <XCircle className="h-12 w-12 mx-auto text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-red-700">Invalid Link</h3>
              <p className="text-muted-foreground">
                The verification link is invalid or malformed.
              </p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={handleResendVerification} 
                disabled={state.isResending || state.retryCount >= 3}
                className="w-full"
              >
                {state.isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Request New Verification Email
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/auth')}
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          </div>
        );

      case 'error':
      default:
        return (
          <div className="text-center space-y-4">
            <XCircle className="h-12 w-12 mx-auto text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-red-700">Verification Failed</h3>
              <p className="text-muted-foreground">
                We couldn't verify your email. This might be a temporary issue.
              </p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={handleRetry}
                variant="outline"
                className="w-full"
              >
                <RefreshCw className="mr-2 h-4 w-4" />
                Try Again
              </Button>
              <Button 
                onClick={handleResendVerification} 
                disabled={state.isResending || state.retryCount >= 3}
                className="w-full"
              >
                {state.isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Resend Verification Email
                  </>
                )}
              </Button>
              <Button 
                variant="outline" 
                onClick={() => navigate('/auth')}
                className="w-full"
              >
                Back to Login
              </Button>
            </div>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <CardTitle>Email Verification</CardTitle>
          <CardDescription>Confirming your account</CardDescription>
        </CardHeader>
        <CardContent>
          {renderContent()}
          {state.retryCount > 0 && (
            <div className="mt-4 p-3 bg-muted rounded-lg">
              <p className="text-sm text-muted-foreground text-center">
                Verification attempts: {state.retryCount}/3
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
};

export default EmailVerificationPage;