
import React from 'react';
import SmsSettingsForm from '../SmsSettingsForm';
import EmailSettingsForm from '../EmailSettingsForm';
import CommunicationToggles from '../CommunicationToggles';
import { TabsContent } from "@/components/ui/tabs";

interface ConnectionSettingsTabProps {
  comm: any;
  loading: boolean;
  testingConnection: boolean;
  testingSmsConnection: boolean;
  smsTestResult: string | null;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  handleTestConnection: () => Promise<void>;
  handleTestSmsConnection: () => Promise<void>;
}

const ConnectionSettingsTab: React.FC<ConnectionSettingsTabProps> = ({
  comm,
  loading,
  testingConnection,
  testingSmsConnection,
  smsTestResult,
  handleChange,
  handleTestConnection,
  handleTestSmsConnection,
}) => {
  return (
    <TabsContent value="connection" className="pt-6">
      <div className="space-y-6">
        <SmsSettingsForm
          comm={comm}
          handleChange={handleChange}
          loading={loading}
          handleTestSmsConnection={handleTestSmsConnection}
          testingSmsConnection={testingSmsConnection}
          smsTestResult={smsTestResult}
        />
        <hr />
        <EmailSettingsForm
          comm={comm}
          handleChange={handleChange}
          loading={loading}
          handleTestConnection={handleTestConnection}
          testingConnection={testingConnection}
        />
        <hr />
        <CommunicationToggles comm={comm} handleChange={handleChange} loading={loading} />
      </div>
    </TabsContent>
  );
};

export default ConnectionSettingsTab;
