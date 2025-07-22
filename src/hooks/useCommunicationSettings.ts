import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";

export const useCommunicationSettings = () => {
  const { toast } = useToast();
  const [comm, setComm] = useState<any>({
    sms_provider: "",
    sms_api_key: "",
    sms_sender_id: "",
    smtp_host: "",
    smtp_port: "",
    smtp_user: "",
    smtp_pass: "",
    sender_email: "",
    enable_sms: false,
    enable_email: false,
    email_templates: [],
    sms_templates: [],
    triggers: {},
  });
  const [loading, setLoading] = useState(false);
  const [testingConnection, setTestingConnection] = useState(false);
  const [testingSmsConnection, setTestingSmsConnection] = useState(false);
  const [smsTestResult, setSmsTestResult] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke("communication-settings", {
          method: "GET",
        });
        if (error || data?.error) {
          toast({
            title: "Error loading communication settings",
            description: error?.message || data?.error || "An error occurred.",
            variant: "destructive",
          });
        } else if (data?.data) {
          setComm(data.data);
        }
      } catch (e: any) {
        toast({
          title: "Network Error",
          description: e.message || String(e),
          variant: "destructive",
        });
      }
      setLoading(false);
    };
    load();
  }, [toast]);

  const handleChange = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value, type, checked } = e.target;
    setComm((prevComm: any) => ({
      ...prevComm,
      [name]: type === "checkbox" ? checked : value,
    }));
  }, []);

  const handleEmailTemplatesChange = useCallback((newTemplates: any[]) => {
    setComm((prev: any) => ({ ...prev, email_templates: newTemplates }));
  }, []);

  const handleSmsTemplatesChange = useCallback((newTemplates: any[]) => {
    setComm((prev: any) => ({ ...prev, sms_templates: newTemplates }));
  }, []);

  const handleTriggersChange = useCallback((newTriggers: any) => {
    setComm((prev: any) => ({ ...prev, triggers: newTriggers }));
  }, []);

  const handleTestConnection = useCallback(async () => {
    setTestingConnection(true);
    toast({ title: "Testing SMTP Connection..." });
    
    const { smtp_host, smtp_port, smtp_user, smtp_pass, sender_email } = comm;

    if (!smtp_host || !smtp_port || !smtp_user || !smtp_pass || !sender_email) {
      toast({
        title: "Missing SMTP Information",
        description: "Please fill all SMTP fields to test the connection.",
        variant: "destructive",
      });
      setTestingConnection(false);
      return;
    }

    try {
      const { data, error } = await supabase.functions.invoke("test-smtp-connection", {
        body: { smtp_host, smtp_port, smtp_user, smtp_pass, sender_email },
      });

      if (error || data?.error) {
        toast({
          title: "Connection Failed",
          description: error?.message || data?.error || "Unable to connect to SMTP server.",
          variant: "destructive",
        });
      } else {
        toast({
          title: "Connection Successful",
          description: "A test email has been sent to your sender email address.",
        });
      }
    } catch (err: any) {
      toast({
        title: "Network error",
        description: err.message || String(err),
        variant: "destructive",
      });
    }

    setTestingConnection(false);
  }, [comm, toast]);

  const handleTestSmsConnection = useCallback(async () => {
    setSmsTestResult(null);
    setTestingSmsConnection(true);

    const { sms_provider, sms_api_key, sms_sender_id } = comm;

    if (!sms_provider || !sms_provider.toLowerCase().includes("mysmstab")) {
      setSmsTestResult("Provider must include 'mysmstab'");
      setTestingSmsConnection(false);
      return;
    }
    if (!sms_api_key || sms_api_key.length < 6) {
      setSmsTestResult("Missing or invalid API Key");
      setTestingSmsConnection(false);
      return;
    }
    if (!sms_sender_id || sms_sender_id.length < 3) {
      setSmsTestResult("Invalid Sender ID");
      setTestingSmsConnection(false);
      return;
    }

    toast({ title: "Testing MySmstab SMS Connection..." });

    try {
      const { data, error } = await supabase.functions.invoke("test-sms-connection", {
        body: { sms_api_key, sms_sender_id },
      });
      if (error || data?.error) {
        setSmsTestResult(`Error: ${error?.message || data?.error || "Unknown error"}`);
        toast({
          title: "SMS Test Failed",
          description: error?.message || data?.error || "Unable to connect to MySmstab SMS API.",
          variant: "destructive",
        });
      } else if (data?.data && data?.data.success) {
        setSmsTestResult("Success: Test SMS sent via MySmstab!");
        toast({
          title: "Connection Successful",
          description: "A test SMS was sent from MySmstab. Check the dashboard.",
        });
      } else {
        setSmsTestResult("Error: Unknown/invalid result from MySmstab API");
        toast({
          title: "SMS Test Failed",
          description: "Check your API key, sender ID, and settings.",
          variant: "destructive",
        });
      }
    } catch (err: any) {
      setSmsTestResult(`Network error: ${err.message || String(err)}`);
      toast({
        title: "Network error",
        description: err.message || String(err),
        variant: "destructive",
      });
    }

    setTestingSmsConnection(false);
  }, [comm, toast]);

  const handleSubmit = useCallback(async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    
    try {
      const { data, error } = await supabase.functions.invoke("communication-settings", {
        body: { ...comm },
      });

      if (error || data?.error) {
        toast({
          title: "Error",
          description: error?.message || data?.error || "Unable to save communication settings.",
          variant: "destructive",
        });
      } else if (data?.data) {
        toast({ title: "Communication APIs updated" });
        setComm(data.data);
      }
    } catch (err: any) {
      toast({
        title: "Network error",
        description: err.message || String(err),
        variant: "destructive",
      });
    }
    setLoading(false);
  }, [comm, toast]);

  return {
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
  };
};
