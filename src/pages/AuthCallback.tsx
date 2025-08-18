import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handlePostLoginRedirect } from '@/utils/redirect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { PhoneCollectionModal } from '@/components/auth/PhoneCollectionModal';

export default function AuthCallback() {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
        const type = searchParams.get('type');
        const { data, error } = await supabase.auth.getSession();
        
        if (error) {
          console.error('Auth callback error:', error);
          toast({
            title: "Authentication failed",
            description: error.message || "Please try signing in again.",
            variant: "destructive",
          });
          navigate('/auth');
          return;
        }

        if (data.session?.user) {
          const user = data.session.user;
          setUserEmail(user.email || '');
          
          // Check user role first
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', user.id)
            .single();

          // If admin user, redirect to dashboard
          if (profile?.role === 'admin') {
            toast({
              title: "Welcome back!",
              description: "You have been successfully signed in.",
            });
            const redirectPath = handlePostLoginRedirect('admin');
            navigate(redirectPath);
            return;
          }

          // For customer users (including OAuth), check if phone number is needed
          if (user.app_metadata?.provider === 'google') {
            // Poll for customer account creation with exponential backoff
            const maxAttempts = 10;
            let attempt = 0;
            let customerAccount = null;
            
            while (attempt < maxAttempts && !customerAccount) {
              const { data } = await supabase
                .from('customer_accounts')
                .select('phone, id')
                .eq('user_id', user.id)
                .maybeSingle();
              
              if (data) {
                customerAccount = data;
                break;
              }
              
              // Exponential backoff: 100ms, 200ms, 400ms, 800ms, etc.
              const delay = Math.min(100 * Math.pow(2, attempt), 2000);
              await new Promise(resolve => setTimeout(resolve, delay));
              attempt++;
            }
            
            // If no account found after polling, create it manually as fallback
            if (!customerAccount) {
              console.log('Creating customer account manually for OAuth user');
              const { data: newAccount, error: createError } = await supabase
                .from('customer_accounts')
                .insert({
                  user_id: user.id,
                  email: user.email || '',  // Add required email field
                  name: user.user_metadata?.name || user.user_metadata?.full_name || user.email?.split('@')[0],
                  email_verified: true,
                  profile_completion_percentage: 60
                })
                .select('phone, id')
                .single();
              
              if (!createError && newAccount) {
                customerAccount = newAccount;
              }
            }
            
            if (customerAccount && !customerAccount.phone) {
              setShowPhoneModal(true);
              setIsLoading(false);
              return;
            }
          }

          // Regular redirect for users with complete profiles
          let successMessage = "You have been successfully authenticated.";
          
          if (type === 'recovery') {
            successMessage = "Password reset successful. You are now logged in.";
          } else if (user.email_confirmed_at) {
            successMessage = "Email verified successfully. Welcome to our platform!";
          }
          
          toast({
            title: "Welcome!",
            description: successMessage,
          });
          const redirectPath = handlePostLoginRedirect('customer');
          navigate(redirectPath);
        } else {
          navigate('/auth');
        }
      } catch (error: any) {
        console.error('Callback processing error:', error);
        toast({
          title: "Processing failed",
          description: "There was an issue processing your authentication.",
          variant: "destructive",
        });
        navigate('/auth');
      } finally {
        setIsLoading(false);
      }
    };

    handleAuthCallback();
  }, [navigate, toast, searchParams]);

  const handlePhoneSubmit = async (phone: string) => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      // Update customer account with phone number
      await supabase
        .from('customer_accounts')
        .update({ phone })
        .eq('user_id', data.user.id);
      
      toast({
        title: "Profile completed!",
        description: "Your phone number has been saved successfully.",
      });
      
      // Navigate with proper redirect handling
      const redirectPath = handlePostLoginRedirect('customer');
      navigate(redirectPath);
    }
  };

  const handlePhoneSkip = () => {
    // Phone is now required, but we keep this for backward compatibility
    // Users will be shown the modal again until they provide a phone number
    setShowPhoneModal(false);
    const redirectPath = handlePostLoginRedirect('customer');
    navigate(redirectPath);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background">
        <div className="flex flex-col items-center gap-4">
          <CheckCircle className="h-12 w-12 text-primary animate-pulse" />
          <p className="text-lg font-medium">Signing you in...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <PhoneCollectionModal
        isOpen={showPhoneModal}
        onClose={() => {}} // Make modal non-dismissible for required phone collection
        onSubmit={handlePhoneSubmit}
        userEmail={userEmail}
      />
    </>
  );
}