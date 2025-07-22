
import React from 'react';
import { Input } from "@/components/ui/input";
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';

interface SmsSettingsFormProps {
  comm: any;
  handleChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  loading: boolean;
  handleTestSmsConnection: () => Promise<void>;
  testingSmsConnection: boolean;
  smsTestResult: string | null;
}

const SmsSettingsForm: React.FC<SmsSettingsFormProps> = ({
  comm,
  handleChange,
  loading,
  handleTestSmsConnection,
  testingSmsConnection,
  smsTestResult
}) => {
  // Validation examples - simple format checks, real validation can be richer
  const apiKeyValid = (comm.sms_api_key || '').length > 5;
  const senderIdValid = (comm.sms_sender_id || '').length > 2 && (comm.sms_sender_id || '').length <= 11;
  const providerValid = !!(comm.sms_provider && comm.sms_provider.toLowerCase().includes('mysmstab'));

  return (
    <div className="space-y-4">
      <h2 className="text-xl font-bold flex items-center gap-2">
        SMS API (MySmstab)
        <a
          href="https://mysmstab.com/"
          target="_blank"
          rel="noopener noreferrer"
          className="ml-2 underline text-blue-600 text-xs"
        >
          What is MySmstab?
        </a>
      </h2>
      <div>
        <Label htmlFor="sms_provider" className="block text-sm font-medium mb-1">Provider (must be "mysmstab")</Label>
        <Input 
          id="sms_provider"
          name="sms_provider" 
          placeholder="e.g. mysmstab"
          value={comm.sms_provider || ""} 
          onChange={handleChange} 
          disabled={loading}
          className={!providerValid ? "border-red-500" : ""}
        />
        {!providerValid && (
          <div className="text-xs text-destructive mt-1">Provider must contain "mysmstab"</div>
        )}
      </div>
      <div>
        <Label htmlFor="sms_api_key" className="block text-sm font-medium mb-1">MySmstab API Key</Label>
        <Input 
          id="sms_api_key"
          name="sms_api_key" 
          type="password"
          placeholder="API Key from MySmstab dashboard"
          value={comm.sms_api_key || ""} 
          onChange={handleChange}
          disabled={loading}
          className={!apiKeyValid ? "border-red-500" : ""}
        />
        {!apiKeyValid && (
          <div className="text-xs text-destructive mt-1">Enter your MySmstab API key</div>
        )}
      </div>
      <div>
        <Label htmlFor="sms_sender_id" className="block text-sm font-medium mb-1">
          Sender ID
        </Label>
        <Input 
          id="sms_sender_id"
          name="sms_sender_id" 
          placeholder="e.g. Restaurant"
          value={comm.sms_sender_id || ""} 
          onChange={handleChange}
          disabled={loading}
          className={!senderIdValid ? "border-red-500" : ""}
        />
        <div className="text-xs text-gray-500">Alphanumeric, up to 11 characters</div>
        {!senderIdValid && (
          <div className="text-xs text-destructive mt-1">Sender ID must be 3-11 alphanumeric characters</div>
        )}
      </div>
      <div className="flex items-center gap-3">
        <Button
          type="button"
          disabled={loading || !apiKeyValid || !senderIdValid || !providerValid || testingSmsConnection}
          onClick={handleTestSmsConnection}
          variant="outline"
        >
          {testingSmsConnection ? "Testing SMS..." : "Test MySmstab Connection"}
        </Button>
        {smsTestResult && (
          <span className={`text-sm ml-2 ${smsTestResult.startsWith("Success") ? "text-green-600" : "text-destructive"}`}>
            {smsTestResult}
          </span>
        )}
      </div>
      <div className="text-xs mt-2 text-gray-500">
        Need help? <a href="https://mysmstab.com/" target="_blank" rel="noopener" className="underline">Go to MySmstab Dashboard</a>
      </div>
    </div>
  );
};

export default SmsSettingsForm;
