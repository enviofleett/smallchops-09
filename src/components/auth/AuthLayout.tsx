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
    <div className="min-h-screen bg-gradient-to-br from-orange-50 to-red-50 flex items-center justify-center p-4">
      <Card className="w-full max-w-md p-8">
        {showLogo && (
          <div className="text-center mb-8">
            <div className="w-24 h-24 rounded-full mx-auto mb-4 flex items-center justify-center overflow-hidden bg-white shadow-lg">
              <img 
                src={startersLogo} 
                alt="Starters" 
                className="w-full h-full object-contain p-2"
                loading="lazy"
              />
            </div>
            <h1 className="text-2xl font-bold text-gray-800">{title}</h1>
            <p className="text-gray-600 mt-2">{subtitle}</p>
          </div>
        )}
        {children}
      </Card>
    </div>
  );
};

export default AuthLayout;