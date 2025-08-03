import { useState, useEffect } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import { supabase } from '@/integrations/supabase/client';
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { AlertCircle, CheckCircle2, Shield } from "lucide-react";

const setupSchema = z.object({
  fullName: z.string().min(2, "Name must be at least 2 characters"),
  password: z.string().min(8, "Password must be at least 8 characters"),
  confirmPassword: z.string().min(8, "Please confirm your password"),
}).refine((data) => data.password === data.confirmPassword, {
  message: "Passwords don't match",
  path: ["confirmPassword"],
});

type SetupFormData = z.infer<typeof setupSchema>;

interface InvitationData {
  invitation_id: string;
  email: string;
  role: string;
  is_valid: boolean;
  expires_at: string;
}

export default function AdminSetup() {
  const [searchParams] = useSearchParams();
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [invitationData, setInvitationData] = useState<InvitationData | null>(null);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { toast } = useToast();
  const token = searchParams.get('token');

  const form = useForm<SetupFormData>({
    resolver: zodResolver(setupSchema),
    defaultValues: {
      fullName: "",
      password: "",
      confirmPassword: "",
    },
  });

  useEffect(() => {
    validateToken();
  }, [token]);

  const validateToken = async () => {
    if (!token) {
      setError("Invalid invitation link. No token provided.");
      setIsLoading(false);
      return;
    }

    try {
      // Query the admin_invitations table directly  
      const response: any = await supabase
        .from('admin_invitations')
        .select('id, email, role, expires_at, status, accepted_at')
        .eq('invitation_token', token);
      
      const { data: invitations, error } = response;

      if (error) throw error;

      const invitation = invitations?.[0];
      if (!invitation) {
        setError("Invalid or expired invitation token.");
        setIsLoading(false);
        return;
      }

      // Check if invitation is valid
      const now = new Date();
      const expiresAt = new Date(invitation.expires_at);
      const isValid = expiresAt > now && invitation.status === 'pending' && !invitation.accepted_at;
      
      if (!isValid) {
        if (expiresAt <= now) {
          setError("This invitation has expired.");
        } else if (invitation.accepted_at) {
          setError("This invitation has already been used.");
        } else {
          setError("This invitation is no longer valid.");
        }
        setIsLoading(false);
        return;
      }

      setInvitationData({
        invitation_id: invitation.id,
        email: invitation.email,
        role: invitation.role,
        is_valid: isValid,
        expires_at: invitation.expires_at,
      });
    } catch (err: any) {
      console.error('Token validation error:', err);
      setError("Unable to validate invitation. Please try again or contact support.");
    } finally {
      setIsLoading(false);
    }
  };

  const onSubmit = async (data: SetupFormData) => {
    if (!token || !invitationData) {
      toast({
        title: "Error",
        description: "Invalid invitation data",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      // Create user via Supabase Auth with email redirect
      const { data: authData, error: authError } = await supabase.auth.signUp({
        email: invitationData.email,
        password: data.password,
        options: {
          data: {
            name: data.fullName,
            role: invitationData.role,
            invitation_id: invitationData.invitation_id,
          },
          emailRedirectTo: `${window.location.origin}/settings`,
        },
      });

      if (authError) throw authError;

      if (!authData.user) {
        throw new Error("Failed to create user account");
      }

      // Update the invitation as accepted
      const { error: updateError } = await supabase
        .from('admin_invitations')
        .update({
          status: 'accepted',
          accepted_at: new Date().toISOString(),
          setup_completed_at: new Date().toISOString(),
        })
        .eq('id', invitationData.invitation_id);

      if (updateError) {
        console.error('Failed to update invitation:', updateError);
        // Don't fail the entire process for this
      }

      // Create or update profile
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: authData.user.id,
          name: data.fullName,
          role: invitationData.role as any,
          status: 'active',
          created_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        });

      if (profileError) {
        console.error('Failed to create profile:', profileError);
        // Profile creation may be handled by triggers, so don't fail
      }

      // Log the successful admin setup
      try {
        await supabase
          .from('audit_logs')
          .insert({
            user_id: authData.user.id,
            action: 'admin_setup_completed',
            category: 'Admin Management',
            entity_type: 'admin_invitation',
            entity_id: invitationData.invitation_id,
            message: `Admin setup completed for ${invitationData.email} with role ${invitationData.role}`,
            new_values: {
              user_id: authData.user.id,
              email: invitationData.email,
              role: invitationData.role,
              full_name: data.fullName,
              setup_timestamp: new Date().toISOString(),
            }
          });
      } catch (logError) {
        console.error('Failed to log admin setup:', logError);
      }

      toast({
        title: "Account Created Successfully!",
        description: "Your admin account has been set up. You can now access the admin panel.",
      });

      // Automatically sign in the user
      try {
        const { error: signInError } = await supabase.auth.signInWithPassword({
          email: invitationData.email,
          password: data.password,
        });

        if (signInError) {
          console.error('Auto sign-in failed:', signInError);
          toast({
            title: "Account Created",
            description: "Please sign in with your new credentials.",
          });
          navigate('/auth');
          return;
        }

        // Successful auto sign-in, redirect to admin panel
        toast({
          title: "Welcome!",
          description: "You are now logged in. Redirecting to admin panel...",
        });

        setTimeout(() => {
          navigate('/settings');
        }, 2000);

      } catch (signInError) {
        console.error('Sign-in error:', signInError);
        navigate('/auth');
      }

    } catch (err: any) {
      console.error('Setup error:', err);
      
      let errorMessage = "Failed to create account. Please try again.";
      
      if (err.message?.includes('email already')) {
        errorMessage = "An account with this email already exists. Please contact support.";
      } else if (err.message?.includes('password')) {
        errorMessage = "Password does not meet security requirements. Please use a stronger password.";
      } else if (err.message?.includes('network') || err.message?.includes('fetch')) {
        errorMessage = "Network error. Please check your connection and try again.";
      } else if (err.message?.includes('invalid')) {
        errorMessage = "Invalid invitation data. Please request a new invitation.";
      } else if (err.message) {
        errorMessage = err.message;
      }
      
      toast({
        title: "Setup Failed",
        description: errorMessage,
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardContent className="pt-6">
            <div className="flex items-center justify-center space-x-2">
              <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-primary"></div>
              <span>Validating invitation...</span>
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <AlertCircle className="mx-auto h-12 w-12 text-destructive mb-4" />
            <CardTitle className="text-xl">Invalid Invitation</CardTitle>
            <CardDescription>{error}</CardDescription>
          </CardHeader>
          <CardContent>
            <Button 
              onClick={() => navigate('/')} 
              className="w-full"
              variant="outline"
            >
              Go to Homepage
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-primary/5 to-secondary/5 flex items-center justify-center p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center space-y-4">
          <Shield className="mx-auto h-12 w-12 text-primary" />
          <div>
            <CardTitle className="text-2xl">Set Up Admin Account</CardTitle>
            <CardDescription>
              Complete your admin account setup for {invitationData?.email}
            </CardDescription>
          </div>
          <div className="bg-primary/10 rounded-lg p-3">
            <div className="flex items-center justify-center space-x-2 text-sm">
              <CheckCircle2 className="h-4 w-4 text-primary" />
              <span className="font-medium">{invitationData?.role?.toUpperCase()} Access</span>
            </div>
          </div>
        </CardHeader>

        <CardContent className="space-y-6">
          <Alert>
            <Shield className="h-4 w-4" />
            <AlertDescription>
              This invitation expires on {new Date(invitationData?.expires_at || '').toLocaleDateString()}
            </AlertDescription>
          </Alert>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full Name</FormLabel>
                    <FormControl>
                      <Input 
                        placeholder="Enter your full name"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder="Create a secure password"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="confirmPassword"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Confirm Password</FormLabel>
                    <FormControl>
                      <Input 
                        type="password"
                        placeholder="Confirm your password"
                        {...field} 
                      />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-4">
                <Button 
                  type="submit" 
                  className="w-full" 
                  disabled={isSubmitting}
                >
                  {isSubmitting ? "Creating Account..." : "Create Admin Account"}
                </Button>
              </div>
            </form>
          </Form>

          <div className="text-center text-sm text-muted-foreground">
            <p>By creating an account, you agree to our terms of service and will have {invitationData?.role} access to the admin panel.</p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}