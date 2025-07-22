
import React from 'react';
import EmailTemplateManager from '../EmailTemplateManager';
import { TabsContent } from "@/components/ui/tabs";

interface EmailTemplatesTabContentProps {
  comm: any;
  loading: boolean;
  handleEmailTemplatesChange: (newTemplates: any[]) => void;
}

const EmailTemplatesTabContent: React.FC<EmailTemplatesTabContentProps> = ({
  comm,
  loading,
  handleEmailTemplatesChange,
}) => {
  return (
    <TabsContent value="email_templates" className="pt-6">
      <EmailTemplateManager
        templates={comm.email_templates || []}
        onTemplatesChange={handleEmailTemplatesChange}
        loading={loading}
      />
    </TabsContent>
  );
};

export default EmailTemplatesTabContent;
