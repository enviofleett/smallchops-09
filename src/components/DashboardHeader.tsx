
import React from 'react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

const DashboardHeader = () => {
  const { data: settings } = useBusinessSettings();

  return (
    <div className="mb-8">
      <div className="mb-4">
        <h1 className="text-3xl font-bold">Starters Premium SmallChops</h1>
        <p className="text-muted-foreground">
          {settings?.tagline || "Here's what's happening with your business today"}
        </p>
      </div>
    </div>
  );
};

export default DashboardHeader;
