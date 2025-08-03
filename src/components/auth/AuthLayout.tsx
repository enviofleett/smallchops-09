import React from 'react';
import { Card } from '@/components/ui/card';
import startersLogo from '@/assets/starters-logo.png';
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
      {/* Image Section - Top on mobile, Left on desktop */}
      <div className="w-full h-48 sm:h-64 lg:h-screen lg:w-1/2 relative overflow-hidden">
        <div className="absolute inset-0 bg-gradient-to-br from-primary/20 to-primary/40 z-10" />
        <img src="/lovable-uploads/c25fd79f-d9c7-466d-9189-55f68cc44b83.png" alt="Delicious family meal" className="w-full h-full object-cover" />
        <div className="absolute inset-0 z-20 flex flex-col justify-center items-center text-white p-4 lg:p-12">
          
        </div>
      </div>

      {/* Form Section - Bottom on mobile, Right on desktop */}
      <div className="w-full lg:w-1/2 flex items-center justify-center p-4 sm:p-6 lg:p-8 flex-1">
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