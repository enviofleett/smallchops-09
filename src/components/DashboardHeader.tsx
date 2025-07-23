
import React from 'react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

const DashboardHeader = () => {
  const { data: settings } = useBusinessSettings();

  return (
    <div className="mb-6 w-full">
      <div className="text-center sm:text-left">
        <h1 className="text-2xl sm:text-3xl lg:text-4xl font-bold text-foreground leading-tight mb-2">
          Welcome to<br className="sm:hidden" />
          <span className="block sm:inline"> {settings?.name || 'Starters Small Chops'}</span>
        </h1>
        <p className="text-sm sm:text-base text-muted-foreground">
          {settings?.tagline || "Here's what's happening with your business today"}
        </p>
      </div>
    </div>
  );
};

export default DashboardHeader;
