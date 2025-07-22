
import React from 'react';
import { useBusinessSettings } from '@/hooks/useBusinessSettings';

const DashboardHeader = () => {
  const { data: settings } = useBusinessSettings();

  return (
    <div className="mb-8">
      <div className="flex items-center space-x-4 mb-4">
        <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center overflow-hidden">
          {settings?.logo_url ? (
            <img 
              src={settings.logo_url} 
              alt={settings.name} 
              className="w-full h-full object-contain"
            />
          ) : (
            <span className="text-primary-foreground font-bold text-lg">
              {settings?.name?.charAt(0) || 'D'}
            </span>
          )}
        </div>
        <div>
          <h1 className="text-3xl font-bold">Welcome to {settings?.name || 'DotCrafts'}</h1>
          <p className="text-muted-foreground">
            {settings?.tagline || "Here's what's happening with your business today"}
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
