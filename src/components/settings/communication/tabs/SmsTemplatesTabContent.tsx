
import React from 'react';
import SmsTemplateManager from '../SmsTemplateManager';
import { TabsContent } from "@/components/ui/tabs";

interface SmsTemplatesTabContentProps {
  comm: any;
  loading: boolean;
  handleSmsTemplatesChange: (newTemplates: any[]) => void;
}

const SmsTemplatesTabContent: React.FC<SmsTemplatesTabContentProps> = ({
  comm,
  loading,
  handleSmsTemplatesChange,
}) => {
  return (
    <TabsContent value="sms_templates" className="pt-6">
      <SmsTemplateManager
        templates={comm.sms_templates || []}
        onTemplatesChange={handleSmsTemplatesChange}
        loading={loading}
      />
    </TabsContent>
  );
};

export default SmsTemplatesTabContent;
