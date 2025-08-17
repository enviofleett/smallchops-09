import React, { useState } from 'react';
import { User, LogIn, LogOut } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from '@/components/ui/dropdown-menu';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { AuthModal } from './AuthModal';
import { useAuthContext } from './AuthProvider';
import { useToast } from '@/hooks/use-toast';

interface AuthButtonProps {
  variant?: 'default' | 'outline' | 'ghost';
  size?: 'default' | 'sm' | 'lg' | 'icon';
  showText?: boolean;
}

export const AuthButton: React.FC<AuthButtonProps> = ({ 
  variant = 'default', 
  size = 'default',
  showText = true 
}) => {
  const [showAuthModal, setShowAuthModal] = useState(false);
  const { user, isAuthenticated, isLoading, signOut } = useAuthContext();
  const { toast } = useToast();

  const handleSignOut = async () => {
    try {
      await signOut();
      toast({
        title: "Signed out",
        description: "You have been signed out successfully."
      });
    } catch (error) {
      toast({
        title: "Error",
        description: "Failed to sign out. Please try again.",
        variant: "destructive"
      });
    }
  };

  if (isLoading) {
    return (
      <Button variant={variant} size={size} disabled>
        <User className="h-4 w-4" />
        {showText && <span className="ml-2">Loading...</span>}
      </Button>
    );
  }

  if (isAuthenticated && user) {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant={variant} size={size} className="flex items-center gap-2">
            <Avatar className="h-6 w-6">
              <AvatarImage src={user.user_metadata?.avatar_url} />
              <AvatarFallback>
                {user.user_metadata?.name?.charAt(0) || user.email?.charAt(0) || 'U'}
              </AvatarFallback>
            </Avatar>
            {showText && (
              <span className="hidden sm:inline-block">
                {user.user_metadata?.name || user.email?.split('@')[0]}
              </span>
            )}
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-56">
          <DropdownMenuItem className="flex flex-col items-start">
            <div className="font-medium">{user.user_metadata?.name || 'User'}</div>
            <div className="text-xs text-muted-foreground">{user.email}</div>
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={() => window.location.href = '/customer-profile'}>
            <User className="mr-2 h-4 w-4" />
            Profile
          </DropdownMenuItem>
          <DropdownMenuItem onClick={() => window.location.href = '/purchase-history'}>
            <User className="mr-2 h-4 w-4" />
            Order History
          </DropdownMenuItem>
          <DropdownMenuSeparator />
          <DropdownMenuItem onClick={handleSignOut}>
            <LogOut className="mr-2 h-4 w-4" />
            Sign Out
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <>
      <Button
        variant={variant}
        size={size}
        onClick={() => setShowAuthModal(true)}
        className="flex items-center gap-2"
      >
        <LogIn className="h-4 w-4" />
        {showText && <span>Sign In</span>}
      </Button>

      <AuthModal
        isOpen={showAuthModal}
        onClose={() => setShowAuthModal(false)}
        onSuccess={() => {
          setShowAuthModal(false);
          toast({
            title: "Welcome!",
            description: "You have been signed in successfully."
          });
        }}
      />
    </>
  );
};