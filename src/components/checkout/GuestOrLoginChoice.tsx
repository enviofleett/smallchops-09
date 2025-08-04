import React from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import { User, UserPlus, Clock, ShoppingBag } from 'lucide-react';
import { Separator } from '@/components/ui/separator';

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
  return (
    <div className="space-y-6">
      <div className="text-center space-y-2">
        <h3 className="text-lg font-semibold">How would you like to checkout?</h3>
        <p className="text-sm text-muted-foreground">
          Choose your preferred checkout method to continue with your ₦{totalAmount.toLocaleString()} order
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Guest Checkout Option */}
        <Card className="cursor-pointer hover:border-primary transition-colors group">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <Clock className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Continue as Guest</h4>
                <p className="text-sm text-muted-foreground">Quick and easy</p>
              </div>
            </div>
            
            <ul className="space-y-2 text-sm text-muted-foreground">
              <li className="flex items-center gap-2">
                <ShoppingBag className="h-4 w-4 text-green-600" />
                Faster checkout process
              </li>
              <li className="flex items-center gap-2">
                <Clock className="h-4 w-4 text-green-600" />
                No account required
              </li>
              <li className="flex items-center gap-2">
                <User className="h-4 w-4 text-yellow-600" />
                Order tracking via email
              </li>
            </ul>

            <Button 
              onClick={onContinueAsGuest}
              className="w-full"
              variant="outline"
            >
              Continue as Guest
            </Button>
          </CardContent>
        </Card>

        {/* Login Option */}
        <Card className="cursor-pointer hover:border-primary transition-colors group border-primary/50">
          <CardContent className="p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="p-3 rounded-full bg-primary/10 group-hover:bg-primary/20 transition-colors">
                <UserPlus className="h-6 w-6 text-primary" />
              </div>
              <div>
                <h4 className="font-semibold">Sign In / Register</h4>
                <p className="text-sm text-muted-foreground">Best experience</p>
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
        Don't worry - you can create an account after placing your order as a guest
      </div>
    </div>
  );
};