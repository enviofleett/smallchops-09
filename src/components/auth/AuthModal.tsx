
import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Eye, EyeOff, Mail, Lock, User, Phone, CheckCircle, Loader2 } from 'lucide-react';
import { useCustomerDirectAuth } from '@/hooks/useCustomerDirectAuth';
import { useRegistrationFlow } from '@/hooks/useRegistrationFlow';
import { RegistrationErrorHandler } from './RegistrationErrorHandler';
import GoogleAuthButton from '@/components/auth/GoogleAuthButton';
import { useToast } from '@/hooks/use-toast';
import { retryGoogleAuth, handleGoogleAuthError } from '@/utils/googleAuthErrorHandler';

interface AuthModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess?: () => void;
  title?: string;
  subtitle?: string;
}

export const AuthModal: React.FC<AuthModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
  title = "Welcome",
  subtitle = "Sign in to your account or create a new one"
}) => {
  const [activeTab, setActiveTab] = useState<'login' | 'register'>('login');
  const [showPassword, setShowPassword] = useState(false);
  const [loginData, setLoginData] = useState({ email: '', password: '' });
  const [registerData, setRegisterData] = useState({
    name: '',
    email: '',
    password: '',
    phone: ''
  });

  const { login, signUpWithGoogle, isLoading: loginLoading } = useCustomerDirectAuth();
  const { 
    isLoading: registerLoading, 
    error: registerError, 
    step: registerStep,
    registrationEmail,
    handleRegister,
    handleResendVerification,
    resetFlow,
    retryRegistration
  } = useRegistrationFlow();
  const { toast } = useToast();

  const handleLoginSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!loginData.email || !loginData.password) {
      toast({
        title: "Please fill in all fields",
        variant: "destructive"
      });
      return;
    }

    const result = await login(loginData.email, loginData.password);
    if (result.success) {
      onSuccess?.();
      onClose();
    }
  };

  const handleRegisterSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!registerData.name || !registerData.email || !registerData.password || !registerData.phone) {
      toast({
        title: "Please fill in all fields",
        description: "All fields are required for registration",
        variant: "destructive"
      });
      return;
    }

    await handleRegister(registerData);
  };

  const handleTabChange = (value: string) => {
    setActiveTab(value as 'login' | 'register');
    resetFlow();
  };

  const handleGoogleAuth = async () => {
    try {
      const result = await retryGoogleAuth(signUpWithGoogle, 2, 1000);
      if (result.success) {
        onSuccess?.();
        onClose();
      }
    } catch (error: any) {
      const authError = handleGoogleAuthError(error);
      toast({
        title: "Google authentication failed",
        description: authError.userMessage,
        variant: "destructive"
      });
    }
  };

  const renderRegistrationStep = () => {
    switch (registerStep) {
      case 'verification':
        return (
          <div className="text-center py-6">
            <Mail className="h-12 w-12 text-primary mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Check your email</h3>
            <p className="text-muted-foreground mb-6">
              We've sent a verification link to <strong>{registrationEmail}</strong>
            </p>
            <div className="space-y-3">
              <Button
                type="button"
                variant="outline"
                onClick={handleResendVerification}
                disabled={registerLoading}
                className="w-full"
              >
                Resend verification email
              </Button>
              <Button
                type="button"
                variant="ghost"
                onClick={resetFlow}
                className="w-full"
              >
                Use different email
              </Button>
            </div>
          </div>
        );

      case 'success':
        return (
          <div className="text-center py-6">
            <CheckCircle className="h-12 w-12 text-green-500 mx-auto mb-4" />
            <h3 className="text-lg font-semibold mb-2">Registration successful!</h3>
            <p className="text-muted-foreground mb-6">
              Welcome! You can now start shopping.
            </p>
            <Button onClick={() => { onSuccess?.(); onClose(); }} className="w-full">
              Continue
            </Button>
          </div>
        );

      default:
        return (
          <form onSubmit={handleRegisterSubmit} className="space-y-4">
            {registerError && (
              <RegistrationErrorHandler
                error={registerError}
                onRetry={retryRegistration}
                onReset={resetFlow}
              />
            )}
            
            <div className="space-y-2">
              <Label htmlFor="register-name">Full Name</Label>
              <div className="relative">
                <User className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-name"
                  type="text"
                  placeholder="Enter your full name"
                  value={registerData.name}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, name: e.target.value }))}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-email">Email</Label>
              <div className="relative">
                <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-email"
                  type="email"
                  placeholder="Enter your email"
                  value={registerData.email}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, email: e.target.value }))}
                  className="pl-10"
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-phone">Phone Number</Label>
              <div className="relative">
                <Phone className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-phone"
                  type="tel"
                  placeholder="Enter your phone number"
                  value={registerData.phone}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, phone: e.target.value }))}
                  className="pl-10"
                  required
                />
              </div>
              <p className="text-xs text-muted-foreground">
                Required for order updates and delivery coordination
              </p>
            </div>

            <div className="space-y-2">
              <Label htmlFor="register-password">Password</Label>
              <div className="relative">
                <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                <Input
                  id="register-password"
                  type={showPassword ? "text" : "password"}
                  placeholder="Create a password"
                  value={registerData.password}
                  onChange={(e) => setRegisterData(prev => ({ ...prev, password: e.target.value }))}
                  className="pl-10 pr-10"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
            </div>

            <Button 
              type="submit" 
              className="w-full" 
              disabled={registerLoading}
            >
              {registerLoading ? "Creating account..." : "Create Account"}
            </Button>

            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <span className="w-full border-t" />
              </div>
              <div className="relative flex justify-center text-xs uppercase">
                <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
              </div>
            </div>

            <GoogleAuthButton 
              onGoogleAuth={handleGoogleAuth}
              isLoading={registerLoading}
              text="Sign up with Google"
              variant="outline"
              mode="register"
              disabled={registerLoading}
            />
          </form>
        );
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="text-center">{title}</DialogTitle>
          {subtitle && (
            <p className="text-center text-muted-foreground text-sm">{subtitle}</p>
          )}
        </DialogHeader>

        <div className="mt-6">
          {registerStep === 'form' ? (
            <Tabs value={activeTab} onValueChange={handleTabChange}>
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="login">Sign In</TabsTrigger>
                <TabsTrigger value="register">Sign Up</TabsTrigger>
              </TabsList>

              <TabsContent value="login" className="mt-6">
                <form onSubmit={handleLoginSubmit} className="space-y-4">
                  <div className="space-y-2">
                    <Label htmlFor="login-email">Email</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-email"
                        type="email"
                        placeholder="Enter your email"
                        value={loginData.email}
                        onChange={(e) => setLoginData(prev => ({ ...prev, email: e.target.value }))}
                        className="pl-10"
                        required
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor="login-password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-3 h-4 w-4 text-muted-foreground" />
                      <Input
                        id="login-password"
                        type={showPassword ? "text" : "password"}
                        placeholder="Enter your password"
                        value={loginData.password}
                        onChange={(e) => setLoginData(prev => ({ ...prev, password: e.target.value }))}
                        className="pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-3 text-muted-foreground hover:text-foreground"
                      >
                        {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                      </button>
                    </div>
                  </div>

                  <Button 
                    type="submit" 
                    className="w-full" 
                    disabled={loginLoading}
                  >
                    {loginLoading ? "Signing in..." : "Sign In"}
                  </Button>

                  <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                      <span className="w-full border-t" />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                      <span className="bg-background px-2 text-muted-foreground">Or continue with</span>
                    </div>
                  </div>

                  <GoogleAuthButton 
                    onGoogleAuth={handleGoogleAuth}
                    isLoading={loginLoading}
                    text="Continue with Google"
                    variant="outline"
                    disabled={loginLoading}
                  />
                </form>
              </TabsContent>

              <TabsContent value="register" className="mt-6">
                {renderRegistrationStep()}
              </TabsContent>
            </Tabs>
          ) : (
            renderRegistrationStep()
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
