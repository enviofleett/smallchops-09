import React from 'react';
import { Card } from '@/components/ui/card';
import startersLogo from '@/assets/starters-logo-christmas.png';
import loginHero from '@/assets/login-hero.jpg';
interface AuthLayoutProps {
  children: React.ReactNode;
  title: string;
  subtitle: string;
  showLogo?: boolean;
}
const AuthLayout = ({
  children,
  title,
  subtitle,
  showLogo = true
}: AuthLayoutProps) => {
  return <div className="min-h-screen bg-white flex flex-col lg:flex-row">
      {/* Image Section - Hidden on mobile, Left side on desktop */}
      <div className="hidden lg:block lg:w-1/2 lg:h-screen relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/40 z-10" />
        <img 
          src={loginHero} 
          alt="People enjoying Starters food and community" 
          className="w-full h-full object-cover" 
          onError={(e) => {
            // Fallback to gradient background
            e.currentTarget.style.display = 'none';
            e.currentTarget.parentElement.style.background = 'linear-gradient(135deg, hsl(var(--primary)) 0%, hsl(var(--primary-foreground)) 100%)';
          }}
        />
        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-white p-12">
          
        </div>
      </div>

      {/* Form Section - Full width on mobile, Right side on desktop */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8 min-h-screen lg:min-h-0">
        <div className="w-full max-w-md space-y-6 lg:space-y-8">
          {showLogo && <div className="text-center">
              <div className="w-16 h-16 lg:w-20 lg:h-20 rounded-full mx-auto mb-4 lg:mb-6 flex items-center justify-center overflow-hidden bg-primary/10">
                <img src={startersLogo} alt="Starters" className="w-full h-full object-contain p-2" loading="lazy" />
              </div>
              <h1 className="text-2xl lg:text-3xl font-bold text-foreground">{title}</h1>
              <p className="text-muted-foreground mt-2 text-base lg:text-lg">{subtitle}</p>
            </div>}

          <Card className="p-4 sm:p-6 lg:p-8 shadow-lg border">
            {children}
          </Card>
        </div>
      </div>
    </div>;
};
export default AuthLayout;