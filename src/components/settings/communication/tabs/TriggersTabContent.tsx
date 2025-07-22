
import React from 'react';
import TriggerManager from '../TriggerManager';
import { TabsContent } from "@/components/ui/tabs";

interface TriggersTabContentProps {
  comm: any;
  loading: boolean;
  handleTriggersChange: (newTriggers: any) => void;
}

const TriggersTabContent: React.FC<TriggersTabContentProps> = ({
  comm,
  loading,
  handleTriggersChange,
}) => {
  return (
    <TabsContent value="triggers" className="pt-6">
      <TriggerManager
        triggers={comm.triggers || {}}
        emailTemplates={comm.email_templates || []}
        smsTemplates={comm.sms_templates || []}
        onTriggersChange={handleTriggersChange}
        loading={loading}
      />
    </TabsContent>
  );
};

export default TriggersTabContent;
