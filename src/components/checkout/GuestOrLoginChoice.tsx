
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

        {/* Guest Option */}
        <Card className="cursor-pointer hover:border-secondary transition-colors group" onClick={onContinueAsGuest}>
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-secondary/10 group-hover:bg-secondary/20 transition-colors">
                <Lock className="h-6 w-6 text-secondary-foreground" />
              </div>
              <div>
                <h4 className="font-semibold">Continue as Guest</h4>
                <p className="text-sm text-muted-foreground">Quick checkout without an account</p>
              </div>
            </div>
            
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-blue-600" />
                Faster checkout process
              </li>
              <li className="flex items-center gap-2">
                <Lock className="h-4 w-4 text-blue-600" />
                No account required
              </li>
              <li className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-orange-600" />
                Can create account after order
              </li>
            </ul>

            <Button variant="outline" className="w-full">
              Continue as Guest
            </Button>
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
