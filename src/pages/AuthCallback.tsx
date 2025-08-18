
import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { PublicHeader } from '@/components/layout/PublicHeader';
import { PublicFooter } from '@/components/layout/PublicFooter';
import { PhoneCollectionModal } from '@/components/auth/PhoneCollectionModal';
import { CheckCircle, AlertCircle, Loader2 } from 'lucide-react';

const AuthCallback: React.FC = () => {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [status, setStatus] = useState<'loading' | 'success' | 'error' | 'phone_required'>('loading');
  const [error, setError] = useState<string>('');
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [userId, setUserId] = useState<string>('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          setError(error.message);
          setStatus('error');
          return;
        }

        if (data.session?.user) {
          const user = data.session.user;
          console.log('Auth callback - user authenticated:', user.email);

          // Check if user has phone number
          const hasPhone = user.user_metadata?.phone || user.phone;
          
          if (!hasPhone) {
            console.log('Phone number required for user:', user.id);
            setUserId(user.id);
            setStatus('phone_required');
            setShowPhoneModal(true);
            return;
          }

          // User is fully authenticated with phone
          setStatus('success');
          
          toast({
            title: "Welcome!",
            description: "You have been successfully authenticated.",
          });

          // Redirect after short delay
          setTimeout(() => {
            const redirectTo = searchParams.get('redirect') || '/';
            navigate(redirectTo, { replace: true });
          }, 1500);
        } else {
          // No active session, redirect to auth page
          console.log('No session found, redirecting to auth');
          navigate('/auth', { replace: true });
        }
      } catch (err) {
        console.error('Unexpected error in auth callback:', err);
        setError('An unexpected error occurred during authentication');
        setStatus('error');
      }
    };

    handleAuthCallback();
  }, [navigate, searchParams, toast]);

  const handlePhoneSubmit = async (phoneNumber: string) => {
    try {
      // Update user metadata with phone number
      const { error: updateError } = await supabase.auth.updateUser({
        data: { phone: phoneNumber }
      });

      if (updateError) {
        throw updateError;
      }

      // Also update the customer_accounts table
      const { error: customerError } = await supabase
        .from('customer_accounts')
        .update({ phone: phoneNumber })
        .eq('user_id', userId);

      if (customerError) {
        console.warn('Failed to update customer phone:', customerError);
      }

      setShowPhoneModal(false);
      setStatus('success');
      
      toast({
        title: "Profile completed!",
        description: "Your account setup is now complete.",
      });

      setTimeout(() => {
        const redirectTo = searchParams.get('redirect') || '/';
        navigate(redirectTo, { replace: true });
      }, 1500);
    } catch (error: any) {
      console.error('Phone update error:', error);
      toast({
        title: "Phone update failed",
        description: error.message || "Failed to update phone number",
        variant: "destructive"
      });
    }
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
            <button
              onClick={() => navigate('/auth')}
              className="bg-primary text-primary-foreground px-4 py-2 rounded-md hover:bg-primary/90"
            >
              Try again
            </button>
          </div>
        );

      default:
        return null;
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
        onClose={() => {}} // Non-dismissible
        title="Complete Your Profile"
        subtitle="Please provide your phone number to complete registration"
      />
      
      <PublicFooter />
    </div>
  );
};

export default AuthCallback;
