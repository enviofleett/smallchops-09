import React, { useEffect, useState } from 'react';

interface HydrationSafeRootProps {
  children: React.ReactNode;
}

export function HydrationSafeRoot({ children }: HydrationSafeRootProps) {
  const [isHydrated, setIsHydrated] = useState(false);

  useEffect(() => {
    // Ensure this only runs on the client
    setIsHydrated(true);
  }, []);

  // During hydration, render a loading state that matches server
  if (!isHydrated) {
    return (
      <div id="app-loading" className="min-h-screen bg-background">
        <div className="flex items-center justify-center min-h-screen">
          <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
        </div>
      </div>
    );
  }

  return <>{children}</>;
}