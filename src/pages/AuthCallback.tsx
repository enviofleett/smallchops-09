import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Loader2, CheckCircle, AlertCircle } from 'lucide-react';

export default function AuthCallback() {
  const navigate = useNavigate();
  const { toast } = useToast();

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

        if (data.session) {
          toast({
            title: "Welcome!",
            description: "You have been successfully signed in.",
          });
          
          // Check user role and redirect appropriately
          const { data: profile } = await supabase
            .from('profiles')
            .select('role')
            .eq('id', data.session.user.id)
            .single();

          if (profile?.role === 'admin') {
            navigate('/dashboard');
          } else {
            navigate('/customer-portal');
          }
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
      }
    };

    handleAuthCallback();
  }, [navigate, toast]);

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