import React, { useState } from "react";
import BusinessTab from "@/components/settings/BusinessTab";
import UsersTab from "@/components/settings/UsersTab";
import PaymentTab from "@/components/settings/PaymentTab";
import CommunicationTab from "@/components/settings/CommunicationTab";
import EnvioApiTab from "@/components/settings/EnvioApiTab";
import { ContentManagementTab } from "@/components/settings/ContentManagementTab";
import DeliveryManagementTab from "@/components/settings/DeliveryManagementTab";
import DeliveryVehiclesTab from "@/components/settings/DeliveryVehiclesTab";
import { Badge } from "@/components/ui/badge";
import { Building, Users, CreditCard, MessageSquare, Code, FileText, Truck, ListChecks, Contact, Map } from "lucide-react";
import CommunicationLogsTab from "@/components/settings/communication/CommunicationLogsTab";
import CustomerPreferencesTab from "@/components/settings/CustomerPreferencesTab";
import MapApiTab from "@/components/settings/MapApiTab";
import DevelopersCornerTab from "@/components/settings/DevelopersCornerTab";

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

  const ActiveComponent = TABS.find((tab) => tab.value === activeTab)?.component;

  return (
    <div className="flex flex-col h-full">
      <div>
        <h1 className="text-3xl font-bold text-gray-800">Settings &amp; Configurations</h1>
        <div className="flex items-center gap-2 mt-2">
          <Badge variant="outline" className="text-green-600 border-green-600">
            System Ready
          </Badge>
          <span className="text-sm text-gray-500">All services are operational</span>
        </div>
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
