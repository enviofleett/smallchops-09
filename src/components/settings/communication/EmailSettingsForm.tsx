
import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface EmailSettingsFormProps {
  comm: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
  handleTestConnection: () => Promise<void>;
  testingConnection: boolean;
}

const EmailSettingsForm: React.FC<EmailSettingsFormProps> = ({ comm, handleChange, loading, handleTestConnection, testingConnection }) => {
  return (
    <div className="space-y-4 pt-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold">SMTP Configuration</h2>
        <Button 
          type="button" 
          variant="outline" 
          onClick={handleTestConnection} 
          disabled={loading || testingConnection}
        >
          {testingConnection ? "Testing..." : "Test Connection"}
        </Button>
      </div>
      <div>
        <Label htmlFor="sender_email" className="block text-sm font-medium mb-1">Sender Email</Label>
        <Input
          id="sender_email"
          name="sender_email" 
          placeholder="e.g., no-reply@yourdomain.com"
          value={comm.sender_email || ""} 
          onChange={handleChange}
          disabled={loading}
        />
      </div>
      <div>
        <Label htmlFor="smtp_host" className="block text-sm font-medium mb-1">SMTP Host</Label>
        <Input 
          id="smtp_host"
          name="smtp_host" 
          placeholder="e.g., smtp.gmail.com"
          value={comm.smtp_host || ""} 
          onChange={handleChange}
          disabled={loading}
        />
      </div>
      <div>
        <Label htmlFor="smtp_port" className="block text-sm font-medium mb-1">SMTP Port</Label>
        <Input 
          id="smtp_port"
          name="smtp_port" 
          type="number" 
          placeholder="e.g., 587 or 465"
          value={comm.smtp_port || ""} 
          onChange={handleChange}
          disabled={loading}
        />
      </div>
      <div>
        <Label htmlFor="smtp_user" className="block text-sm font-medium mb-1">SMTP User</Label>
        <Input 
          id="smtp_user"
          name="smtp_user" 
          placeholder="e.g., your-email@gmail.com"
          value={comm.smtp_user || ""} 
          onChange={handleChange}
          disabled={loading}
        />
      </div>
      <div>
        <Label htmlFor="smtp_pass" className="block text-sm font-medium mb-1">SMTP Pass</Label>
        <Input 
          id="smtp_pass"
          name="smtp_pass" 
          type="password" 
          placeholder="Your email password or app password"
          value={comm.smtp_pass || ""} 
          onChange={handleChange}
          disabled={loading}
        />
      </div>
    </div>
  );
};

export default EmailSettingsForm;
