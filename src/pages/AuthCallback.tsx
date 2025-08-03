import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { handlePostLoginRedirect } from '@/utils/redirect';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';
import { PhoneCollectionModal } from '@/components/auth/PhoneCollectionModal';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(true);
  const [showPhoneModal, setShowPhoneModal] = useState(false);
  const [userEmail, setUserEmail] = useState<string>('');

  useEffect(() => {
    const handleAuthCallback = async () => {
      try {
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
            // Wait for customer account to be created by trigger
            await new Promise(resolve => setTimeout(resolve, 3000));
            
            // Check if customer account exists and has phone
            const { data: customerAccount } = await supabase
              .from('customer_accounts')
              .select('phone')
              .eq('user_id', user.id)
              .single();
            
            if (customerAccount && !customerAccount.phone) {
              setShowPhoneModal(true);
              setIsLoading(false);
              return;
            }
          }

          // Regular redirect for users with complete profiles
          toast({
            title: "Welcome!",
            description: "You have been successfully authenticated.",
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
  }, [navigate, toast]);

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
    setShowPhoneModal(false);
    const redirectPath = handlePostLoginRedirect('customer');
    navigate(redirectPath);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-br from-primary/5 to-secondary/5 p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <CardTitle className="flex items-center justify-center gap-2">
              <Loader2 className="h-5 w-5 animate-spin" />
              Processing Authentication
            </CardTitle>
            <CardDescription>
              Please wait while we complete your sign in...
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <div className="space-y-4">
              <div className="flex justify-center">
                <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin"></div>
              </div>
              <p className="text-sm text-muted-foreground">
                This should only take a moment.
              </p>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <>
      <PhoneCollectionModal
        isOpen={showPhoneModal}
        onClose={handlePhoneSkip}
        onSubmit={handlePhoneSubmit}
        userEmail={userEmail}
      />
    </>
  );
}