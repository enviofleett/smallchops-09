
import React from 'react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

const DashboardHeader = () => {
  const { data: settings } = useBusinessSettings();

  return (
    <div className="mb-6 sm:mb-8">
      <div className="mb-4">
        <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-foreground leading-tight">
          Welcome to {settings?.name || 'Starters Small Chops'}
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground mt-2">
          {settings?.tagline || "Here's what's happening with your business today"}
        </p>
      </div>
    </div>
  );
};

export default DashboardHeader;
