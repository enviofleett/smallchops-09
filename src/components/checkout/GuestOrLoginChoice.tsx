
import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { User, UserPlus, Clock, ShoppingBag, Lock } from 'lucide-react';
import { Separator } from '@/components/ui/separator';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

interface GuestOrLoginChoiceProps {
  onContinueAsGuest: () => void;
  onLogin: () => void;
  totalAmount: number;
}

export const GuestOrLoginChoice: React.FC<GuestOrLoginChoiceProps> = ({
  onContinueAsGuest,
  onLogin,
  totalAmount,
}) => {
  // Force login - no guest checkout option available
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Please sign in to continue</h3>
        <p className="text-sm text-muted-foreground">
          Sign in or create an account to proceed with your ₦{totalAmount.toLocaleString()} order
        </p>
      </div>

      <div className="flex justify-center">
        {/* Login Option - Centered */}
        <Card className="cursor-pointer hover:border-primary transition-colors group border-primary/50 w-full max-w-md">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Sign In / Register</h4>
                <p className="text-sm text-muted-foreground">Required to proceed</p>
              </div>
            </div>
            
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-green-600" />
                Save addresses & preferences
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                Order history & tracking
              </li>
              <li className="flex items-center gap-2">
                <User className="h-4 w-4 text-green-600" />
                Faster future checkouts
              </li>
            </ul>

            <Button 
              onClick={onLogin}
              className="w-full"
            >
              Sign In / Register
            </Button>
          </CardContent>
        </Card>
      </div>

      <Separator />
      
      <div className="text-center text-xs text-muted-foreground">
        An account is required to place orders. Please sign in or create a new account to continue.
      </div>
    </div>
  );
};
