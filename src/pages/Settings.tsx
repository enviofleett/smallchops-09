import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { MobileTabs } from "@/components/ui/mobile-tabs";
import { ComprehensiveBrandingTab } from "@/components/branding/ComprehensiveBrandingTab";
import { AdminUserControl } from "@/components/settings/AdminUserControl";
import { CommunicationsTab } from "@/components/settings/CommunicationsTab";
import { PaymentSettingsTab } from "@/components/payments/PaymentSettingsTab";
import { ContentManagementTab } from "@/components/blog/ContentManagementTab";
import { WhatsAppSupportTab } from "@/components/settings/WhatsAppSupportTab";
import { EmailProcessingTab } from "@/components/settings/EmailProcessingTab";
import { EmailDeliveryMonitor } from "@/components/settings/EmailDeliveryMonitor";
import { EmailHealthDashboard } from "@/components/admin/EmailHealthDashboard";
import { Settings as SettingsIcon } from "lucide-react";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { AuthenticationEndpointsTab } from "@/components/settings/AuthenticationEndpointsTab";
import { BuyingLogicEndpointsTab } from "@/components/settings/BuyingLogicEndpointsTab";
import { PickupPointsManager } from "@/components/admin/PickupPointsManager";
import RegistrationHealth from "./RegistrationHealth";
import AdminCheckoutSettingsCard from '@/components/admin/settings/AdminCheckoutSettingsCard';
import PaymentsWebhooksPanel from '@/components/admin/dev/PaymentsWebhooksPanel';
import { PerformanceDebugger } from '@/components/monitoring/PerformanceDebugger';
import { EmailCredentialsManager } from '@/components/admin/EmailCredentialsManager';
import { ProductionReadinessStatus } from "@/components/admin/ProductionReadinessStatus";

const Settings = () => {
  const [activeTab, setActiveTab] = useState("communications");

  // Check if current user is admin to show admin controls
  const { data: userProfile } = useQuery({
    queryKey: ['user-profile'],
    queryFn: async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return null;
      const { data, error } = await supabase.from('profiles').select('role').eq('id', user.id).single();
      if (error) throw error;
      return data;
    }
  });
  
  const isAdmin = userProfile?.role === 'admin';

  const mainTabs = [
    {
      value: "communications",
      label: "Communications",
      content: (
        <MobileTabs
          defaultValue="branding"
          tabs={[
            {
              value: "branding",
              label: "Branding",
              content: <ComprehensiveBrandingTab />
            },
            {
              value: "content", 
              label: "Content",
              content: <ContentManagementTab />
            },
            {
              value: "support",
              label: "Support", 
              content: <WhatsAppSupportTab />
            },
            {
              value: "email-processing",
              label: "Email Queue",
              content: (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg md:text-xl">Email Queue Processing</CardTitle>
                    <CardDescription className="text-sm">
                      Monitor and manage email queue processing and delivery
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <EmailProcessingTab />
                  </CardContent>
                </Card>
              )
            }
          ]}
        />
      )
    },
    {
      value: "payments", 
      label: "Payments",
      content: (
        <MobileTabs
          defaultValue="payment-providers"
          tabs={[
            {
              value: "payment-providers",
              label: "Payment Providers",
              content: (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg md:text-xl">Payment Settings</CardTitle>
                    <CardDescription className="text-sm">
                      Configure payment providers and processing options
                    </CardDescription>
                  </CardHeader>
                  <CardContent>
                    <PaymentSettingsTab />
                  </CardContent>
                </Card>
              )
            },
            {
              value: "pickup-points",
              label: "Pickup Points", 
              content: <PickupPointsManager />
            }
          ]}
        />
      )
    },
    ...(isAdmin ? [{
      value: "admin",
      label: "Admin",
      content: <AdminUserControl />
    }] : []),
    ...(isAdmin ? [{
      value: "developer",
      label: "Developer", 
      content: (
        <MobileTabs
          defaultValue="auth-endpoints"
          tabs={[
            {
              value: "auth-endpoints",
              label: "Auth API",
              content: <AuthenticationEndpointsTab />
            },
            {
              value: "buying-logic", 
              label: "Buying Logic",
              content: <BuyingLogicEndpointsTab />
            },
            {
              value: "checkout",
              label: "Checkout",
              content: (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg md:text-xl">Checkout Settings</CardTitle>
                    <CardDescription className="text-sm">Enable or disable guest checkout</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <AdminCheckoutSettingsCard />
                  </CardContent>
                </Card>
              )
            },
            {
              value: "payments-webhooks",
              label: "Payments",
              content: <PaymentsWebhooksPanel />
            },
            {
              value: "email",
              label: "Email",
              content: (
                <MobileTabs
                  defaultValue="credentials"
                  tabs={[
                    {
                      value: "credentials",
                      label: "Credentials", 
                      content: (
                        <Card>
                          <CardContent className="pt-6">
                            <EmailCredentialsManager />
                          </CardContent>
                        </Card>
                      )
                    },
                    {
                      value: "communications",
                      label: "Settings",
                      content: (
                        <Card>
                          <CardContent className="pt-6">
                            <CommunicationsTab />
                          </CardContent>
                        </Card>
                      )
                    },
                    {
                      value: "processing",
                      label: "Processing",
                      content: (
                        <Card>
                          <CardHeader className="pb-4">
                            <CardTitle className="text-lg md:text-xl">Email Processing & Queue Management</CardTitle>
                            <CardDescription className="text-sm">
                              Process queued emails and manage email queue
                            </CardDescription>
                          </CardHeader>
                          <CardContent>
                            <EmailProcessingTab />
                          </CardContent>
                        </Card>
                      )
                    },
                    {
                      value: "monitoring",
                      label: "Monitoring",
                      content: <EmailDeliveryMonitor />
                    },
                    {
                      value: "analytics", 
                      label: "Analytics",
                      content: <EmailHealthDashboard />
                    }
                  ]}
                />
              )
            },
            {
              value: "oauth",
              label: "OAuth",
              content: (
                <Card>
                  <CardHeader className="pb-4">
                    <CardTitle className="text-lg md:text-xl">Google OAuth Configuration</CardTitle>
                    <CardDescription className="text-sm">
                      Setup Google OAuth authentication for customer login
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-4 md:space-y-6">
                    <div className="bg-blue-50 dark:bg-blue-950 p-4 rounded-lg">
                      <h3 className="font-semibold text-blue-900 dark:text-blue-100 mb-3 text-sm md:text-base">🔐 Google OAuth Setup Instructions</h3>
                      <div className="space-y-3 md:space-y-4 text-xs md:text-sm text-blue-800 dark:text-blue-200">
                        <div>
                          <h4 className="font-medium mb-2">1. Google Cloud Console Setup</h4>
                          <ul className="space-y-1 ml-4 text-xs md:text-sm">
                            <li>• Go to <a href="https://console.cloud.google.com" target="_blank" rel="noopener noreferrer" className="underline hover:no-underline">Google Cloud Console</a></li>
                            <li>• Create a new project or select existing project</li>
                            <li>• Enable the Google+ API</li>
                          </ul>
                        </div>
                        <div>
                          <h4 className="font-medium mb-2">2. OAuth Consent Screen</h4>
                          <ul className="space-y-1 ml-4 text-xs md:text-sm">
                            <li>• Go to APIs & Services → OAuth consent screen</li>
                            <li>• Choose "External" user type</li>
                            <li>• Add authorized domains: <code className="bg-muted px-1 py-0.5 rounded text-xs">oknnklksdiqaifhxaccs.supabase.co</code></li>
                            <li>• Add your production domain when ready</li>
                          </ul>
                        </div>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              )
            },
            {
              value: "registration-health",
              label: "Registration Health", 
              content: <RegistrationHealth />
            },
            {
              value: "production-readiness",
              label: "Production",
              content: <ProductionReadinessStatus />
            },
            {
              value: "performance",
              label: "Performance",
              content: <PerformanceDebugger />
            }
          ]}
        />
      )
    }] : [])
  ];

  return (
    <div className="container mx-auto py-4 md:py-6 space-y-4 md:space-y-6 px-4 max-w-7xl">
      <div className="flex flex-col space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center space-y-4 sm:space-y-0 sm:space-x-4">
          <div className="w-12 h-12 bg-gradient-to-br from-primary to-primary/80 rounded-lg flex items-center justify-center flex-shrink-0">
            <SettingsIcon className="w-6 h-6 text-primary-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <h1 className="text-xl sm:text-2xl md:text-3xl font-bold truncate">Settings</h1>
            <p className="text-sm md:text-base text-muted-foreground">Manage your business settings and preferences</p>
          </div>
        </div>
      </div>

      <MobileTabs
        value={activeTab}
        onValueChange={setActiveTab}
        tabs={mainTabs}
        className="space-y-4 md:space-y-6"
      />
    </div>
  );
};

export default Settings;