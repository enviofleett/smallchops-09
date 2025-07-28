import { useState, useEffect } from "react";
import { useSearchParams } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CheckCircle, Mail, AlertCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const Unsubscribe = () => {
  const [searchParams] = useSearchParams();
  const { toast } = useToast();
  const [isLoading, setIsLoading] = useState(false);
  const [isUnsubscribed, setIsUnsubscribed] = useState(false);
  const [email, setEmail] = useState("");

  useEffect(() => {
    const emailParam = searchParams.get("email");
    if (emailParam) {
      setEmail(decodeURIComponent(emailParam));
    }
  }, [searchParams]);

  const handleUnsubscribe = async () => {
    if (!email) {
      toast({
        title: "Error",
        description: "No email address provided",
        variant: "destructive",
      });
      return;
    }

    setIsLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('email-compliance-manager', {
        body: {
          action: 'unsubscribe',
          email: email,
          data: {
            source: 'unsubscribe_page',
            timestamp: new Date().toISOString()
          }
        }
      });

      if (error) {
        throw error;
      }

      if (data.success) {
        setIsUnsubscribed(true);
        toast({
          title: "Successfully Unsubscribed",
          description: "You have been removed from all email communications.",
        });
      } else {
        throw new Error(data.message || 'Failed to unsubscribe');
      }
    } catch (error) {
      console.error('Unsubscribe error:', error);
      toast({
        title: "Error",
        description: "Failed to process unsubscribe request. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  };

  if (isUnsubscribed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-background p-4">
        <Card className="w-full max-w-md">
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 h-12 w-12 text-green-500">
              <CheckCircle className="h-12 w-12" />
            </div>
            <CardTitle className="text-green-600">Successfully Unsubscribed</CardTitle>
            <CardDescription>
              You have been removed from all email communications for {email}
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center space-y-4">
            <p className="text-sm text-muted-foreground">
              We're sorry to see you go. You will no longer receive marketing emails from us.
            </p>
            <p className="text-xs text-muted-foreground">
              Note: You may still receive important transactional emails related to your orders or account.
            </p>
            <Button 
              variant="outline" 
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Return to Website
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-background p-4">
      <Card className="w-full max-w-md">
        <CardHeader className="text-center">
          <div className="mx-auto mb-4 h-12 w-12 text-orange-500">
            <Mail className="h-12 w-12" />
          </div>
          <CardTitle>Unsubscribe from Emails</CardTitle>
          <CardDescription>
            We're sorry to see you go. Click below to unsubscribe from our email communications.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {email && (
            <div className="p-3 bg-muted rounded-lg">
              <p className="text-sm font-medium">Email Address:</p>
              <p className="text-sm text-muted-foreground">{email}</p>
            </div>
          )}
          
          {!email && (
            <div className="p-3 bg-orange-50 border border-orange-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
              <div>
                <p className="text-sm font-medium text-orange-800">No Email Address</p>
                <p className="text-xs text-orange-600">
                  Please use the unsubscribe link from your email to proceed.
                </p>
              </div>
            </div>
          )}

          <div className="space-y-2">
            <p className="text-sm text-muted-foreground">
              If you unsubscribe, you will no longer receive:
            </p>
            <ul className="text-sm text-muted-foreground space-y-1 pl-4">
              <li>• Marketing emails and promotions</li>
              <li>• Newsletter updates</li>
              <li>• Product announcements</li>
            </ul>
          </div>

          <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <p className="text-xs text-blue-800">
              <strong>Note:</strong> You may still receive important transactional emails 
              related to your orders, account security, and legal notices.
            </p>
          </div>

          <div className="flex flex-col gap-2 pt-4">
            <Button
              onClick={handleUnsubscribe}
              disabled={!email || isLoading}
              variant="destructive"
              className="w-full"
            >
              {isLoading ? "Processing..." : "Unsubscribe from All Emails"}
            </Button>
            
            <Button
              variant="outline"
              onClick={() => window.location.href = '/'}
              className="w-full"
            >
              Keep Subscription & Return to Website
            </Button>
          </div>

          <div className="pt-4 border-t">
            <p className="text-xs text-muted-foreground text-center">
              Having trouble? Contact us at{" "}
              <a href="mailto:support@yourbusiness.com" className="underline">
                support@yourbusiness.com
              </a>
            </p>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default Unsubscribe;