
import React, { useState, useEffect } from "react";
import BusinessTab from "@/components/settings/BusinessTab";
import UsersTab from "@/components/settings/UsersTab";
import PaymentTab from "@/components/settings/PaymentTab";
import CommunicationTab from "@/components/settings/CommunicationTab";
import EnvioApiTab from "@/components/settings/EnvioApiTab";
import { ContentManagementTab } from "@/components/settings/ContentManagementTab";
import DeliveryManagementTab from "@/components/settings/DeliveryManagementTab";
import DeliveryVehiclesTab from "@/components/settings/DeliveryVehiclesTab";
import { Badge } from "@/components/ui/badge";
import { Building, Users, CreditCard, MessageSquare, Code, FileText, Truck, ListChecks, Contact, Map, Wifi, WifiOff, AlertTriangle } from "lucide-react";
import CommunicationLogsTab from "@/components/settings/communication/CommunicationLogsTab";
import CustomerPreferencesTab from "@/components/settings/CustomerPreferencesTab";
import MapApiTab from "@/components/settings/MapApiTab";
import DevelopersCornerTab from "@/components/settings/DevelopersCornerTab";
import { Alert, AlertDescription } from "@/components/ui/alert";

const TABS = [
  { value: "business", label: "Business", icon: Building, component: () => <BusinessTab /> },
  { value: "users", label: "Users", icon: Users, component: () => <UsersTab /> },
  { value: "payment", label: "Payment", icon: CreditCard, component: () => <PaymentTab /> },
  { value: "communication", label: "Communication", icon: MessageSquare, component: () => <CommunicationTab /> },
  { value: "communication-logs", label: "Comm. Logs", icon: ListChecks, component: () => <CommunicationLogsTab /> },
  { value: "customer-preferences", label: "Customer Prefs", icon: Contact, component: () => <CustomerPreferencesTab /> },
  { value: "delivery", label: "Delivery", icon: Truck, component: () => <DeliveryManagementTab /> },
  { value: "vehicles", label: "Delivery Vehicles", icon: Truck, component: () => <DeliveryVehiclesTab /> },
  { value: "envioapi", label: "Envio API", icon: Code, component: () => <EnvioApiTab /> },
  { value: "mapapi", label: "Map API", icon: Map, component: () => <MapApiTab /> },
  { value: "content", label: "Content", icon: FileText, component: () => <ContentManagementTab /> },
  { value: "developers-corner", label: "Developers Corner", icon: Code, component: () => <DevelopersCornerTab /> },
];

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

  const ActiveComponent = TABS.find((tab) => tab.value === activeTab)?.component;

  const getSystemStatus = () => {
    if (!isOnline) return { status: "Offline", color: "bg-red-500", icon: WifiOff };
    if (hasError) return { status: "Connection Issues", color: "bg-yellow-500", icon: AlertTriangle };
    return { status: "System Ready", color: "bg-green-500", icon: Wifi };
  };

  const systemStatus = getSystemStatus();
  const StatusIcon = systemStatus.icon;

  return (
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
      
      <div className="flex flex-1 gap-8 mt-6">
        <nav className="w-60 flex-shrink-0">
           <div className="bg-white rounded-xl shadow-sm border border-gray-100 p-4 h-fit">
              <ul className="space-y-1">
                {TABS.map((tab) => (
                  <li key={tab.value}>
                    <button
                      onClick={() => setActiveTab(tab.value)}
                      className={`flex items-center w-full space-x-3 px-3 py-3 rounded-xl text-left text-sm font-medium transition-all duration-200 group ${
                        activeTab === tab.value
                          ? 'bg-gradient-to-r from-blue-50 to-purple-50 text-blue-600 shadow-sm'
                          : 'text-gray-600 hover:bg-gray-50 hover:text-gray-800'
                      }`}
                    >
                      <tab.icon className="h-5 w-5" />
                      <span>{tab.label}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </div>
        </nav>

        <main className="flex-1">
          {ActiveComponent && <ActiveComponent />}
        </main>
      </div>
    </div>
  );
};

export default Settings;
