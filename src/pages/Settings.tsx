
import React, { useState, useEffect, Suspense } from "react";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Skeleton } from "@/components/ui/skeleton";
import { Wifi, WifiOff, AlertTriangle } from "lucide-react";
import { SETTINGS_TABS, TAB_CATEGORIES } from "@/config/settingsTabs";
import { SettingsProvider } from "@/contexts/SettingsContext";
import ErrorBoundary from "@/components/ErrorBoundary";

const TabContentSkeleton = () => (
  <div className="bg-white border border-gray-200 rounded-xl p-6 w-full max-w-3xl">
    <div className="mb-6">
      <Skeleton className="h-6 w-48 mb-2" />
      <Skeleton className="h-4 w-96" />
    </div>
    <div className="space-y-4">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div>
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-10 w-full" />
        </div>
        <div>
          <Skeleton className="h-4 w-24 mb-1" />
          <Skeleton className="h-10 w-full" />
        </div>
      </div>
    </div>
  </div>
);

const Settings = () => {
  const [activeTab, setActiveTab] = useState("business");
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [hasError, setHasError] = useState(false);

  useEffect(() => {
    const handleOnline = () => {
      setIsOnline(true);
      setHasError(false);
    };
    const handleOffline = () => setIsOnline(false);
    
    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);
    
    // Test connection to Supabase
    const testConnection = async () => {
      try {
        await fetch('https://oknnklksdiqaifhxaccs.supabase.co/rest/v1/', {
          method: 'HEAD',
          mode: 'no-cors'
        });
        setHasError(false);
      } catch {
        setHasError(true);
      }
    };
    
    testConnection();
    
    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  const getSystemStatus = () => {
    if (!isOnline) return { status: "Offline", color: "bg-red-500", icon: WifiOff };
    if (hasError) return { status: "Connection Issues", color: "bg-yellow-500", icon: AlertTriangle };
    return { status: "System Ready", color: "bg-green-500", icon: Wifi };
  };

  const systemStatus = getSystemStatus();
  const StatusIcon = systemStatus.icon;

  const activeTabConfig = SETTINGS_TABS.find(tab => tab.value === activeTab);

  // Filter tabs based on online status
  const availableTabs = SETTINGS_TABS.filter(tab => {
    if (!isOnline && tab.requiresOnline) return false;
    return true;
  });

  return (
    <SettingsProvider>
      <div className="flex flex-col h-full">
        <div>
          <h1 className="text-3xl font-bold text-gray-800">Settings &amp; Configurations</h1>
          <div className="flex items-center gap-2 mt-2">
            <Badge variant="outline" className={`text-white border-transparent ${systemStatus.color}`}>
              <StatusIcon className="h-3 w-3 mr-1" />
              {systemStatus.status}
            </Badge>
            <span className="text-sm text-gray-500">
              {isOnline ? "All services are operational" : "You are currently offline"}
            </span>
          </div>
          
          {!isOnline && (
            <Alert className="mt-4 max-w-3xl">
              <WifiOff className="h-4 w-4" />
              <AlertDescription>
                You are currently offline. Some features may not work properly until your connection is restored.
              </AlertDescription>
            </Alert>
          )}
          
          {hasError && isOnline && (
            <Alert className="mt-4 max-w-3xl">
              <AlertTriangle className="h-4 w-4" />
              <AlertDescription>
                There may be connectivity issues with our servers. If problems persist, please try refreshing the page.
              </AlertDescription>
            </Alert>
          )}
        </div>
        
        <Tabs value={activeTab} onValueChange={setActiveTab} orientation="vertical" className="flex flex-1 gap-8 mt-6">
          <nav className="w-60 flex-shrink-0">
            <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-fit">
              <TabsList className="flex flex-col h-auto w-full space-y-6 bg-transparent p-0">
                {TAB_CATEGORIES.map(category => (
                  <div key={category.id} className="w-full">
                    <h3 className="text-sm font-semibold text-gray-900 mb-2">
                      {category.label}
                    </h3>
                    <div className="space-y-1 w-full">
                      {category.tabs
                        .filter(tab => availableTabs.includes(tab))
                        .map(tab => (
                          <TabsTrigger
                            key={tab.value}
                            value={tab.value}
                            className="w-full justify-start space-x-3 px-3 py-3 rounded-xl text-left text-sm font-medium transition-all duration-200 data-[state=active]:bg-gradient-to-r data-[state=active]:from-blue-50 data-[state=active]:to-purple-50 data-[state=active]:text-blue-600 data-[state=active]:shadow-sm text-gray-600 hover:bg-gray-50 hover:text-gray-800"
                          >
                            <tab.icon className="h-5 w-5" />
                            <span>{tab.label}</span>
                          </TabsTrigger>
                        ))}
                    </div>
                  </div>
                ))}
              </TabsList>
            </div>
          </nav>

          <main className="flex-1">
            {availableTabs.map(tab => {
              const TabComponent = tab.component;
              return (
                <TabsContent key={tab.value} value={tab.value} className="mt-0">
                  <ErrorBoundary>
                    <Suspense fallback={<TabContentSkeleton />}>
                      <TabComponent />
                    </Suspense>
                  </ErrorBoundary>
                </TabsContent>
              );
            })}
          </main>
        </Tabs>
      </div>
    </SettingsProvider>
  );
};

export default Settings;
