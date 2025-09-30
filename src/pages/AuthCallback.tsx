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
        // Add timeout protection
        const timeout = setTimeout(() => {
          console.error('Auth callback timeout - redirecting to auth page');
          setError('Authentication timeout. Please try again.');
          setStatus('error');
        }, 15000); // 15 second timeout

        // Retry logic for session retrieval
        let sessionData = null;
        let retryCount = 0;
        const maxRetries = 5;

        while (!sessionData && retryCount < maxRetries) {
          const { data, error } = await supabase.auth.getSession();
          
          if (error) {
            console.error(`Auth callback error (attempt ${retryCount + 1}):`, error);
            if (retryCount === maxRetries - 1) {
              clearTimeout(timeout);
              setError(error.message || 'Failed to retrieve session');
              setStatus('error');
              return;
            }
          }

          if (data.session?.user) {
            sessionData = data;
            console.log('Session retrieved successfully:', data.session.user.email);
            break;
          }

          // Wait before retrying with exponential backoff
          retryCount++;
          if (retryCount < maxRetries) {
            console.log(`No session yet, retry ${retryCount}/${maxRetries}...`);
            await new Promise(resolve => setTimeout(resolve, 500 * retryCount));
          }
        }

        clearTimeout(timeout);

        if (!sessionData?.session?.user) {
          console.error('No session found after retries, redirecting to auth');
          setError('Authentication failed. Please try logging in again.');
          setStatus('error');
          setTimeout(() => navigate('/auth', { replace: true }), 2000);
          return;
        }

        if (sessionData.session?.user) {
          const user = sessionData.session.user;
          console.log('Auth callback - user authenticated:', user.email);
          setUserId(user.id);

          // Check if this is an admin user
          const { data: adminProfile } = await supabase
            .from('profiles')
            .select('*')
            .eq('id', user.id)
            .single();
          
          if (adminProfile) {
            // Admin user - redirect to dashboard
            setStatus('success');
            toast({
              title: "Admin login successful!",
              description: "Welcome to the admin dashboard.",
            });
            setTimeout(() => {
              navigate('/dashboard', { replace: true });
            }, 1500);
            return;
          }
          
          // Check for customer account with retry
          let customerAccount = null;
          let retryCount = 0;
          const maxRetries = 3;
          
          while (!customerAccount && retryCount < maxRetries) {
            const { data } = await supabase
              .from('customer_accounts')
              .select('*')
              .eq('user_id', user.id)
              .maybeSingle();
            
            customerAccount = data;
            if (!customerAccount) {
              retryCount++;
              if (retryCount < maxRetries) {
                console.log(`Customer account not found, retry ${retryCount}/${maxRetries}`);
                await new Promise(resolve => setTimeout(resolve, 1000));
              }
            }
          }
          
          // If still no customer account, try to create one
          if (!customerAccount) {
            console.log('Creating customer account for user:', user.id);
            const { data: newAccount, error: createError } = await supabase
              .from('customer_accounts')
              .insert({
                user_id: user.id,
                name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0] || 'Customer',
                email: user.email,
                phone: user.user_metadata?.phone,
                email_verified: !!user.email_confirmed_at,
                phone_verified: false,
                profile_completion_percentage: user.user_metadata?.phone ? 80 : 60
              })
              .select()
              .single();
            
            if (!createError && newAccount) {
              customerAccount = newAccount;
              console.log('Customer account created successfully:', customerAccount.id);
            }
          }
          
          if (customerAccount) {
            // Customer user - check phone requirement
            const hasPhone = user.user_metadata?.phone || customerAccount.phone;
            
            if (!hasPhone) {
              console.log('Phone number required for customer:', user.id);
              setStatus('phone_required');
              setShowPhoneModal(true);
              return;
            }

            // Only process welcome email for email-verified users
            if (!user.email_confirmed_at) {
              console.log('Email not confirmed, skipping welcome email for:', user.email);
              // Don't allow access until email is confirmed
              setStatus('error');
              setError('Please verify your email address before accessing the platform.');
              return;
            }

            // Check if welcome email has been sent
            const welcomeSent = user.user_metadata?.welcome_sent;
            console.log('Welcome email status for verified user:', user.email, 'welcome_sent:', welcomeSent, 'email_confirmed_at:', user.email_confirmed_at);
            
            if (!welcomeSent) {
              console.log('Triggering welcome email for verified user:', user.email);
              try {
                // Trigger welcome email processor
                const welcomeResponse = await supabase.functions.invoke('customer-welcome-processor', {
                  body: {
                    customer_email: user.email,
                    customer_name: customerAccount.name || user.user_metadata?.name || user.user_metadata?.full_name || 'Customer',
                    trigger_type: 'auth_link'
                  }
                });

                if (welcomeResponse.error) {
                  console.error('Welcome email failed:', welcomeResponse.error);
                } else {
                  console.log('Welcome email triggered successfully for:', user.email);
                  
                  // Mark welcome email as sent in user metadata
                  await supabase.auth.updateUser({
                    data: { welcome_sent: true }
                  });
                  console.log('User metadata updated with welcome_sent=true');
                }

                // Also update customer_accounts email_verified status (non-blocking)
                try {
                  await supabase
                    .from('customer_accounts')
                    .update({ email_verified: true })
                    .eq('user_id', user.id);
                  console.log('Customer account email_verified updated');
                } catch (updateError) {
                  console.warn('Non-blocking: Failed to update customer email_verified:', updateError);
                }

              } catch (welcomeError) {
                console.error('Non-blocking welcome email error:', welcomeError);
                // Don't block authentication flow for welcome email failures
              }
            } else {
              console.log('Welcome email already sent for user:', user.email);
            }

            // Customer authenticated with phone
            setStatus('success');
            toast({
              title: "Welcome!",
              description: "You have been successfully authenticated.",
            });
            setTimeout(() => {
              const redirectTo = searchParams.get('redirect') || '/';
              navigate(redirectTo, { replace: true });
            }, 1500);
          } else {
            // No profile found - this shouldn't happen after retries
            console.error('No user profile found after successful auth');
            setError('Account setup incomplete. Please contact support.');
            setStatus('error');
          }
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
        userEmail={userId} // Pass user ID for context
      />
      
      <PublicFooter />
    </div>
  );
};

export default AuthCallback;
