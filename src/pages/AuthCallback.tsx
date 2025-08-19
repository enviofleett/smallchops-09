import React, { useEffect, useState, useCallback, useRef } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { PhoneCollectionModal } from '@/components/auth/PhoneCollectionModal';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

type AuthStatus = 'loading' | 'success' | 'error' | 'phone_required';

interface UserData {
  id: string;
  email?: string;
  phone?: string;
}

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<AuthStatus>('loading');
  const [error, setError] = useState<string>('');
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [userData, setUserData] = useState<UserData>({ id: '' });
  const [isPhoneSubmitting, setIsPhoneSubmitting] = useState(false);
  const redirectTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const hasProcessedAuth = useRef(false);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (redirectTimeoutRef.current) {
        clearTimeout(redirectTimeoutRef.current);
      }
    };
  }, []);

  const redirectToDestination = useCallback((delay: number = 1500) => {
    if (redirectTimeoutRef.current) {
      clearTimeout(redirectTimeoutRef.current);
    }
    
    redirectTimeoutRef.current = setTimeout(() => {
      const redirectTo = searchParams.get('redirect') || '/dashboard';
      navigate(redirectTo, { replace: true });
    }, delay);
  }, [navigate, searchParams]);

  const handleAuthError = useCallback((errorMessage: string, logError?: any) => {
    if (logError) {
      console.error('Auth callback error:', logError);
    }
    setError(errorMessage);
    setStatus('error');
  }, []);

  const validatePhoneNumber = (phone: string): boolean => {
    // Basic phone validation - adjust regex as needed
    const phoneRegex = /^\+?[\d\s\-\(\)]{10,}$/;
    return phoneRegex.test(phone.trim());
  };

  useEffect(() => {
    // Prevent multiple executions
    if (hasProcessedAuth.current) return;
    hasProcessedAuth.current = true;

    const handleAuthCallback = async () => {
      try {
        setStatus('loading');
        
        // Get current session
        const { data: sessionData, error: sessionError } = await supabase.auth.getSession();
        
        if (sessionError) {
          handleAuthError(sessionError.message, sessionError);
          return;
        }

        if (!sessionData.session?.user) {
          console.log('No active session found, redirecting to auth');
          navigate('/auth', { replace: true });
          return;
        }

        const user = sessionData.session.user;
        console.log('Auth callback - user authenticated:', user.email);

        // Store user data
        const currentUserData: UserData = {
          id: user.id,
          email: user.email,
          phone: user.user_metadata?.phone || user.phone
        };
        setUserData(currentUserData);

        // Check if phone number is required and missing
        if (!currentUserData.phone) {
          console.log('Phone number required for user:', user.id);
          setStatus('phone_required');
          setShowPhoneModal(true);
          return;
        }

        // User is fully authenticated
        setStatus('success');
        
        toast({
          title: "Welcome back!",
          description: "You have been successfully authenticated.",
        });

        redirectToDestination();

      } catch (err) {
        handleAuthError(
          'An unexpected error occurred during authentication',
          err
        );
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams, toast, handleAuthError, redirectToDestination]);

  const handlePhoneSubmit = async (phoneNumber: string) => {
    if (!phoneNumber.trim()) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid phone number",
        variant: "destructive"
      });
      return;
    }

    if (!validatePhoneNumber(phoneNumber)) {
      toast({
        title: "Invalid phone format",
        description: "Please enter a valid phone number with country code",
        variant: "destructive"
      });
      return;
    }

    setIsPhoneSubmitting(true);

    try {
      // Update user metadata with phone number
      const { error: updateError } = await supabase.auth.updateUser({
        data: { phone: phoneNumber.trim() }
      });

      if (updateError) {
        throw updateError;
      }

      // Also update the customer_accounts table if it exists
      try {
        const { error: customerError } = await supabase
          .from('customer_accounts')
          .update({ phone: phoneNumber.trim() })
          .eq('user_id', userData.id);

        if (customerError) {
          console.warn('Failed to update customer phone (table may not exist):', customerError);
          // Don't throw here as this might be expected
        }
      } catch (customerUpdateError) {
        console.warn('Customer accounts table update failed:', customerUpdateError);
        // Continue without failing the entire flow
      }

      // Update local state
      setUserData(prev => ({ ...prev, phone: phoneNumber.trim() }));
      setShowPhoneModal(false);
      setStatus('success');
      
      toast({
        title: "Profile completed!",
        description: "Your account setup is now complete.",
      });

      redirectToDestination();

    } catch (error: any) {
      console.error('Phone update error:', error);
      toast({
        title: "Phone update failed",
        description: error.message || "Failed to update phone number. Please try again.",
        variant: "destructive"
      });
    } finally {
      setIsPhoneSubmitting(false);
    }
  };

  const handlePhoneModalClose = () => {
    // Only allow closing if there's an error or if we want to allow skipping
    // For now, making it non-dismissible as intended
    console.log('Phone modal close attempted - modal is non-dismissible');
  };

  const handleRetryAuth = () => {
    hasProcessedAuth.current = false;
    setStatus('loading');
    setError('');
    window.location.reload(); // Force a fresh auth attempt
  };

  const renderStatus = () => {
    switch (status) {
      case 'loading':
        return (
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold mb-2">Completing authentication...</h2>
            <p className="text-muted-foreground">Please wait while we set up your account.</p>
          </div>
        );

      case 'success':
        return (
          <div className="text-center">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authentication successful!</h2>
            <p className="text-muted-foreground">Redirecting you now...</p>
          </div>
        );

      case 'phone_required':
        return (
          <div className="text-center">
            <Loader2 className="h-12 w-12 text-primary mx-auto mb-4 animate-spin" />
            <h2 className="text-xl font-semibold mb-2">Completing your profile...</h2>
            <p className="text-muted-foreground">We need a few more details to set up your account.</p>
          </div>
        );

      case 'error':
        return (
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Authentication failed</h2>
            <p className="text-muted-foreground mb-4">{error}</p>
            <div className="space-y-2">
              <button
                onClick={handleRetryAuth}
                className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90 transition-colors"
              >
                Retry Authentication
              </button>
              <br />
              <button
                onClick={() => navigate('/auth', { replace: true })}
                className="bg-secondary text-secondary-foreground px-4 py-2 rounded-md hover:bg-secondary/90 transition-colors"
              >
                Back to Sign In
              </button>
            </div>
          </div>
        );

      default:
        return (
          <div className="text-center">
            <AlertCircle className="h-12 w-12 text-destructive mx-auto mb-4" />
            <h2 className="text-xl font-semibold mb-2">Unknown status</h2>
            <p className="text-muted-foreground">Please refresh the page or try again.</p>
          </div>
        );
    }
  };

  return (
    <div className="min-h-screen bg-background">
      <PublicHeader />
      
      <div className="flex items-center justify-center min-h-[60vh] py-12">
        <div className="max-w-md w-full mx-auto px-4">
          {renderStatus()}
        </div>
      </div>

      <PhoneCollectionModal
        isOpen={showPhoneModal}
        onSubmit={handlePhoneSubmit}
        onClose={handlePhoneModalClose}
        userEmail={userData.email || 'Unknown User'} // Fixed: pass email instead of userId
        isLoading={isPhoneSubmitting}
      />
      
      <PublicFooter />
    </div>
  );
};

export default AuthCallback;
