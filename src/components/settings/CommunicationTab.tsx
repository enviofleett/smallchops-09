
import React from "react";
import { Card } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useCommunicationSettings } from "@/hooks/useCommunicationSettings";
import ConnectionSettingsTab from "./communication/tabs/ConnectionSettingsTab";
import TriggersTabContent from "./communication/tabs/TriggersTabContent";
import EmailTemplatesTabContent from "./communication/tabs/EmailTemplatesTabContent";
import SmsTemplatesTabContent from "./communication/tabs/SmsTemplatesTabContent";

const CommunicationTab = () => {
  const {
    comm,
    loading,
    testingConnection,
    testingSmsConnection,
    smsTestResult,
    handleChange,
    handleEmailTemplatesChange,
    handleSmsTemplatesChange,
    handleTriggersChange,
    handleTestConnection,
    handleTestSmsConnection,
    handleSubmit,
  } = useCommunicationSettings();

  return (
    <Card className="max-w-4xl p-6">
      <form onSubmit={handleSubmit}>
        <Tabs defaultValue="connection">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="connection">Connection</TabsTrigger>
            <TabsTrigger value="triggers">Triggers</TabsTrigger>
            <TabsTrigger value="email_templates">Email Templates</TabsTrigger>
            <TabsTrigger value="sms_templates">SMS Templates</TabsTrigger>
          </TabsList>
          
          <ConnectionSettingsTab
            comm={comm}
            loading={loading}
            testingConnection={testingConnection}
            testingSmsConnection={testingSmsConnection}
            smsTestResult={smsTestResult}
            handleChange={handleChange}
            handleTestConnection={handleTestConnection}
            handleTestSmsConnection={handleTestSmsConnection}
          />
          <TriggersTabContent
            comm={comm}
            loading={loading}
            handleTriggersChange={handleTriggersChange}
          />
          <EmailTemplatesTabContent
            comm={comm}
            loading={loading}
            handleEmailTemplatesChange={handleEmailTemplatesChange}
          />
          <SmsTemplatesTabContent
            comm={comm}
            loading={loading}
            handleSmsTemplatesChange={handleSmsTemplatesChange}
          />
        </Tabs>
        <div className="pt-6 mt-4 border-t">
          <Button type="submit" disabled={loading}>
            {loading ? "Saving..." : "Save All Changes"}
          </Button>
        </div>
      </form>
    </Card>
  );
};

export default CommunicationTab;
