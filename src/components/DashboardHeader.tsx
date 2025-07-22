
import React from 'react';
import { useGlobalBusinessSettings } from '@/hooks/useGlobalBusinessSettings';

const DashboardHeader = () => {
  const { settings, loading } = useGlobalBusinessSettings();

  if (loading) {
    return (
      <div className="mb-8">
        <div className="flex items-center space-x-4 mb-4">
          <div className="w-12 h-12 bg-gray-200 rounded-lg animate-pulse"></div>
          <div>
            <div className="w-48 h-6 bg-gray-200 rounded animate-pulse mb-2"></div>
            <div className="w-32 h-4 bg-gray-200 rounded animate-pulse"></div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="mb-8">
      <div className="flex items-center space-x-4 mb-4">
        {settings?.logo_url ? (
          <img 
            src={settings.logo_url} 
            alt={settings.name || "Business Logo"}
            className="w-12 h-12 rounded-lg object-cover border border-gray-200"
          />
        ) : (
          <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
            <span className="text-white font-bold text-lg">
              {settings?.name?.charAt(0) || 'D'}
            </span>
          </div>
        )}
        <div>
          <h1 className="text-3xl font-bold text-gray-800">
            Welcome to {settings?.name || 'DotCrafts'}
          </h1>
          <p className="text-gray-600">
            Here's what's happening with your business today
          </p>
        </div>
      </div>
    </div>
  );
};

export default DashboardHeader;
