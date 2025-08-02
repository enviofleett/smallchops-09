import React, { useEffect, useState } from 'react';
import { useSearchParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import AuthLayout from '@/components/auth/AuthLayout';
import { Button } from '@/components/ui/button';
import { CheckCircle, XCircle, Loader2, Mail } from 'lucide-react';

const EmailVerificationPage = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  
  const [verificationStatus, setVerificationStatus] = useState<'loading' | 'success' | 'error'>('loading');
  const [isResending, setIsResending] = useState(false);

  useEffect(() => {
    const verifyEmail = async () => {
      const token = searchParams.get('token');
      const type = searchParams.get('type');
      
      if (!token || type !== 'signup') {
        setVerificationStatus('error');
        return;
      }

      try {
        const { error } = await supabase.auth.verifyOtp({
          token_hash: token,
          type: 'signup'
        });

        if (error) {
          console.error('Email verification error:', error);
          setVerificationStatus('error');
          return;
        }

        setVerificationStatus('success');
        
        toast({
          title: "Email verified!",
          description: "Your account has been successfully verified.",
        });

        // Redirect after a short delay
        setTimeout(() => {
          navigate('/customer-portal');
        }, 3000);
      } catch (error) {
        console.error('Verification error:', error);
        setVerificationStatus('error');
      }
    };

    verifyEmail();
  }, [searchParams, navigate, toast]);

  const handleResendVerification = async () => {
    setIsResending(true);
    
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
        email: email
      });

      if (error) {
        throw error;
      }

      toast({
        title: "Verification email sent",
        description: "Please check your email for the verification link.",
      });
    } catch (error: any) {
      toast({
        title: "Failed to resend",
        description: error.message || "Please try again later.",
        variant: "destructive"
      });
    } finally {
      setIsResending(false);
    }
  };

  const renderContent = () => {
    switch (verificationStatus) {
      case 'loading':
        return (
          <div className="text-center space-y-4">
            <Loader2 className="h-12 w-12 animate-spin mx-auto text-orange-600" />
            <p className="text-muted-foreground">Verifying your email...</p>
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
            <Button onClick={() => navigate('/customer-portal')} className="w-full">
              Continue to Dashboard
            </Button>
          </div>
        );

      case 'error':
        return (
          <div className="text-center space-y-4">
            <XCircle className="h-12 w-12 mx-auto text-red-600" />
            <div>
              <h3 className="text-lg font-semibold text-red-700">Verification Failed</h3>
              <p className="text-muted-foreground">
                The verification link is invalid or has expired.
              </p>
            </div>
            <div className="space-y-2">
              <Button 
                onClick={handleResendVerification} 
                disabled={isResending}
                className="w-full"
              >
                {isResending ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Sending...
                  </>
                ) : (
                  <>
                    <Mail className="mr-2 h-4 w-4" />
                    Resend Verification
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

      default:
        return null;
    }
  };

  return (
    <AuthLayout 
      title="Email Verification" 
      subtitle="Confirming your account"
      showLogo={false}
    >
      {renderContent()}
    </AuthLayout>
  );
};

export default EmailVerificationPage;