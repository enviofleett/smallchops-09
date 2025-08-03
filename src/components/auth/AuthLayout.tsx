import React from 'react';
import { Card } from '@/components/ui/card';
import startersLogo from '@/assets/starters-logo.png';

interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  showLogo?: boolean;
}

const AuthLayout = ({ children, title, subtitle, showLogo = true }: AuthLayoutProps) => {
  return (
    <div className="min-h-screen bg-white flex">
      {/* Left Side - Image Section */}
      <div className="hidden lg:flex lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/40 z-10" />
        <img 
          src="/lovable-uploads/5a98043f-97e3-4c4f-945c-ad96e2351156.png"
          alt="Delicious family meal"
          className="w-full h-full object-cover"
        />
        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-white p-12">
          <div className="text-center space-y-6 max-w-md">
            <div className="w-20 h-20 rounded-full mx-auto mb-6 flex items-center justify-center overflow-hidden bg-white/20 backdrop-blur-sm border border-white/30">
              <img 
                src={startersLogo} 
                alt="Starters" 
                className="w-full h-full object-contain p-2"
                loading="lazy"
              />
            </div>
            <h1 className="text-4xl font-bold leading-tight">Delicious Bites, Big Smiles</h1>
            <p className="text-xl opacity-90">Experience the joy of great food with your loved ones</p>
          </div>
        </div>
      </div>

      {/* Right Side - Form Section */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-8">
        <div className="w-full max-w-md space-y-8">
          {showLogo && (
            <div className="text-center lg:hidden">
              <div className="w-16 h-16 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden bg-primary/10">
                <img 
                  src={startersLogo} 
                  alt="Starters" 
                  className="w-full h-full object-contain p-2"
                  loading="lazy"
                />
              </div>
              <h1 className="text-2xl font-bold text-foreground">{title}</h1>
              <p className="text-muted-foreground mt-2">{subtitle}</p>
            </div>
          )}
          
          {/* Desktop title */}
          <div className="hidden lg:block text-center">
            <h1 className="text-3xl font-bold text-foreground">{title}</h1>
            <p className="text-muted-foreground mt-2 text-lg">{subtitle}</p>
          </div>

          <Card className="p-8 shadow-lg border">
            {children}
          </Card>
        </div>
      </div>
    </div>
  );
};

export default AuthLayout;