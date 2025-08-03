import React, { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { UserPlus, Gift, X, Star, Clock } from 'lucide-react';
import { useGuestSession } from '@/hooks/useGuestSession';
import { GuestSignupPrompt } from '@/components/checkout/GuestSignupPrompt';

interface AccountConversionBannerProps {
  guestOrderCount?: number;
  onDismiss?: () => void;
}

export const AccountConversionBanner: React.FC<AccountConversionBannerProps> = ({
  guestOrderCount = 0,
  onDismiss
}) => {
  const { guestSession } = useGuestSession();
  const [showSignupPrompt, setShowSignupPrompt] = useState(false);
  const [isDismissed, setIsDismissed] = useState(false);

  if (!guestSession || isDismissed) {
    return null;
  }

  const handleDismiss = () => {
    setIsDismissed(true);
    onDismiss?.();
  };

  const handleCreateAccount = () => {
    setShowSignupPrompt(true);
  };

  return (
    <>
      <Card className="border-primary/20 bg-gradient-to-r from-primary/5 to-primary/10 mb-6">
        <CardContent className="p-4">
          <div className="flex items-start justify-between">
            <div className="flex items-start gap-3">
              <div className="bg-primary/10 p-2 rounded-lg">
                <UserPlus className="h-5 w-5 text-primary" />
              </div>
              <div className="space-y-2">
                <div className="flex items-center gap-2">
                  <h3 className="font-semibold text-foreground">Create Your Account</h3>
                  <Badge variant="secondary" className="text-xs">
                    <Gift className="h-3 w-3 mr-1" />
                    Free
                  </Badge>
                </div>
                
                <p className="text-sm text-muted-foreground">
                  You're shopping as a guest. Create an account to unlock exclusive benefits and track your orders.
                </p>

                {guestOrderCount > 0 && (
                  <p className="text-sm text-primary font-medium">
                    You have {guestOrderCount} guest order{guestOrderCount !== 1 ? 's' : ''} that will be linked to your account!
                  </p>
                )}

                <div className="flex flex-wrap gap-3 text-xs text-muted-foreground">
                  <div className="flex items-center gap-1">
                    <Clock className="h-3 w-3" />
                    Order tracking
                  </div>
                  <div className="flex items-center gap-1">
                    <Star className="h-3 w-3" />
                    Save favorites
                  </div>
                  <div className="flex items-center gap-1">
                    <Gift className="h-3 w-3" />
                    Exclusive offers
                  </div>
                </div>

                <div className="flex gap-2 pt-2">
                  <Button 
                    size="sm" 
                    onClick={handleCreateAccount}
                    className="text-xs"
                  >
                    Create Account
                  </Button>
                  <Button 
                    variant="ghost" 
                    size="sm" 
                    onClick={handleDismiss}
                    className="text-xs"
                  >
                    Maybe Later
                  </Button>
                </div>
              </div>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm" 
              onClick={handleDismiss}
              className="text-muted-foreground hover:text-foreground"
            >
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardContent>
      </Card>

      <GuestSignupPrompt
        isOpen={showSignupPrompt}
        onClose={() => setShowSignupPrompt(false)}
        guestData={{
          name: '',
          email: '',
          phone: ''
        }}
      />
    </>
  );
};