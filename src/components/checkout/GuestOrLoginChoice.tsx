
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
  isEmpty?: boolean;
  onBrowseProducts?: () => void;
}

export const GuestOrLoginChoice: React.FC<GuestOrLoginChoiceProps> = ({
  onContinueAsGuest,
  onLogin,
  totalAmount,
}) => {
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">Choose how to proceed</h3>
        <p className="text-sm text-muted-foreground">
          Complete your ₦{totalAmount.toLocaleString()} order with an account or as a guest
        </p>
      </div>

      <div className="grid gap-4">
        {/* Login Option */}
        <Card className="cursor-pointer hover:border-primary transition-colors group" onClick={onLogin}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Sign In / Register</h4>
                <p className="text-sm text-muted-foreground">Recommended for returning customers</p>
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

            <Button className="w-full">
              Sign In / Register
            </Button>
          </CardContent>
        </Card>

        {/* Guest Option - Production Ready */}
        <Card className="cursor-pointer hover:border-primary transition-all duration-300 group border-2 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10 hover:from-primary/10 hover:to-primary/15 shadow-lg hover:shadow-xl" onClick={onContinueAsGuest}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors border border-primary/20">
                <ShoppingBag className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold text-lg">Continue as Guest</h4>
                <p className="text-sm text-muted-foreground">Quick & secure checkout - No registration needed</p>
              </div>
            </div>
            
            <ul className="space-y-3 text-sm">
              <li className="flex items-center gap-3">
                <div className="p-1 rounded-full bg-green-100">
                  <Clock className="h-3 w-3 text-green-600" />
                </div>
                <span className="text-foreground">Express checkout in under 2 minutes</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="p-1 rounded-full bg-blue-100">
                  <Lock className="h-3 w-3 text-blue-600" />
                </div>
                <span className="text-foreground">Your data is secure & protected</span>
              </li>
              <li className="flex items-center gap-3">
                <div className="p-1 rounded-full bg-orange-100">
                  <UserPlus className="h-3 w-3 text-orange-600" />
                </div>
                <span className="text-foreground">Create account later (optional)</span>
              </li>
            </ul>

            <div className="pt-2">
              <Button className="w-full h-12 text-base font-semibold bg-primary hover:bg-primary/90 text-primary-foreground shadow-md hover:shadow-lg transition-all duration-300 group-hover:scale-[1.02]">
                <ShoppingBag className="h-5 w-5 mr-2" />
                Start Quick Checkout
              </Button>
              <p className="text-xs text-center text-muted-foreground mt-2">
                Secure payment • Free to checkout • No spam
              </p>
            </div>
          </CardContent>
        </Card>
      </div>

      <Separator />
      
      <div className="text-center text-xs text-muted-foreground">
        You can create an account anytime to save your information for future orders
      </div>
    </div>
  );
};
