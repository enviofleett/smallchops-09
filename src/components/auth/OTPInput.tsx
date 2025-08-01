import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { InputOTP, InputOTPGroup, InputOTPSlot } from "@/components/ui/input-otp";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";

interface OTPInputProps {
  email: string;
  purpose: 'login' | 'registration' | 'password_reset';
  customerName?: string;
  onVerified: (result: any) => void;
  onBack?: () => void;
}

export const OTPInput: React.FC<OTPInputProps> = ({
  email,
  purpose,
  customerName,
  onVerified,
  onBack
}) => {
  const [otp, setOtp] = useState('');
  const [isVerifying, setIsVerifying] = useState(false);
  const [isResending, setIsResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const { toast } = useToast();

  // Cooldown timer
  useEffect(() => {
    if (cooldown > 0) {
      const timer = setTimeout(() => setCooldown(cooldown - 1), 1000);
      return () => clearTimeout(timer);
    }
  }, [cooldown]);

  const sendOTP = async () => {
    try {
      setIsResending(true);
      
      const { data, error } = await supabase.functions.invoke('generate-otp-email', {
        body: {
          email,
          purpose,
          customerName
        }
      });

      if (error) throw error;

      if (data?.rateLimited) {
        toast({
          title: "Too many requests",
          description: "Please wait before requesting another code.",
          variant: "destructive",
        });
        return;
      }

      toast({
        title: "Code sent",
        description: `A new verification code has been sent to ${email}`,
      });

      setCooldown(60); // 60 second cooldown
    } catch (error: any) {
      console.error('Error sending OTP:', error);
      toast({
        title: "Failed to send code",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsResending(false);
    }
  };

  const verifyOTP = async () => {
    if (otp.length !== 6) {
      toast({
        title: "Invalid code",
        description: "Please enter a 6-digit verification code.",
        variant: "destructive",
      });
      return;
    }

    try {
      setIsVerifying(true);
      
      const { data, error } = await supabase.functions.invoke('verify-otp', {
        body: {
          email,
          code: otp,
          purpose
        }
      });

      if (error) throw error;

      if (data?.notFound) {
        toast({
          title: "Invalid code",
          description: "No valid code found. Please request a new one.",
          variant: "destructive",
        });
        return;
      }

      if (data?.expired) {
        toast({
          title: "Code expired",
          description: "Please request a new verification code.",
          variant: "destructive",
        });
        return;
      }

      if (data?.invalidCode) {
        toast({
          title: "Incorrect code",
          description: data.error,
          variant: "destructive",
        });
        setOtp(''); // Clear the input
        return;
      }

      if (data?.maxAttemptsReached) {
        toast({
          title: "Too many attempts",
          description: "Please request a new verification code.",
          variant: "destructive",
        });
        setOtp('');
        return;
      }

      // Success!
      toast({
        title: "Verified!",
        description: "Your email has been verified successfully.",
      });

      onVerified(data);
      
    } catch (error: any) {
      console.error('Error verifying OTP:', error);
      toast({
        title: "Verification failed",
        description: error.message || "Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsVerifying(false);
    }
  };

  const getPurposeText = () => {
    switch (purpose) {
      case 'login':
        return 'Enter the login code sent to your email';
      case 'registration':
        return 'Enter the verification code to complete your registration';
      case 'password_reset':
        return 'Enter the code to reset your password';
      default:
        return 'Enter the verification code sent to your email';
    }
  };

  // Send initial OTP when component mounts
  useEffect(() => {
    sendOTP();
  }, []);

  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Verify Your Email</h3>
        <p className="text-sm text-muted-foreground">
          {getPurposeText()}
        </p>
        <p className="text-sm font-medium">{email}</p>
      </div>

      <div className="space-y-4">
        <div className="flex justify-center">
          <InputOTP
            maxLength={6}
            value={otp}
            onChange={setOtp}
            disabled={isVerifying}
          >
            <InputOTPGroup>
              <InputOTPSlot index={0} />
              <InputOTPSlot index={1} />
              <InputOTPSlot index={2} />
              <InputOTPSlot index={3} />
              <InputOTPSlot index={4} />
              <InputOTPSlot index={5} />
            </InputOTPGroup>
          </InputOTP>
        </div>

        <Button
          onClick={verifyOTP}
          disabled={otp.length !== 6 || isVerifying}
          className="w-full"
        >
          {isVerifying ? "Verifying..." : "Verify Code"}
        </Button>

        <div className="text-center space-y-2">
          <p className="text-xs text-muted-foreground">
            Code expires in 5 minutes
          </p>
          
          <Button
            variant="ghost"
            size="sm"
            onClick={sendOTP}
            disabled={isResending || cooldown > 0}
          >
            {isResending ? "Sending..." : 
             cooldown > 0 ? `Resend in ${cooldown}s` : "Resend code"}
          </Button>
          
          {onBack && (
            <Button
              variant="outline"
              size="sm"
              onClick={onBack}
              className="ml-2"
            >
              Back
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};