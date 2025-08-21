import React, { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, Save, AlertCircle, CheckCircle, Shield } from 'lucide-react';

export const LegalTermsManager = () => {
  const [termsContent, setTermsContent] = useState('');
  const [requireAcceptance, setRequireAcceptance] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  // Load existing terms settings
  useEffect(() => {
    const loadTermsData = async () => {
      try {
        setIsLoading(true);

        // Load terms content
        const { data: termsData } = await supabase
          .from('content_management')
          .select('content, is_published')
          .eq('key', 'legal_terms')
          .single();

        // Load requirement setting
        const { data: requirementData } = await supabase
          .from('content_management')
          .select('content')
          .eq('key', 'legal_require_terms_acceptance')
          .single();

        if (termsData) {
          setTermsContent(termsData.content || '');
        }

        if (requirementData) {
          setRequireAcceptance(requirementData.content === 'true');
        }
      } catch (error) {
        console.log('No existing terms data found, starting fresh');
      } finally {
        setIsLoading(false);
      }
    };

    loadTermsData();
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true);

      // Save terms content
      const { error: termsError } = await supabase
        .from('content_management')
        .upsert({
          key: 'legal_terms',
          content: termsContent,
          is_published: termsContent.trim().length > 0,
          updated_at: new Date().toISOString()
        });

      if (termsError) throw termsError;

      // Save requirement setting
      const { error: requirementError } = await supabase
        .from('content_management')
        .upsert({
          key: 'legal_require_terms_acceptance',
          content: requireAcceptance.toString(),
          is_published: true,
          updated_at: new Date().toISOString()
        });

      if (requirementError) throw requirementError;

      toast.success('Legal terms settings saved successfully!');
    } catch (error: any) {
      console.error('Error saving terms:', error);
      toast.error(`Failed to save: ${error.message}`);
    } finally {
      setIsSaving(false);
    }
  };

  if (isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-primary"></div>
            <span className="ml-2 text-muted-foreground">Loading terms settings...</span>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="h-5 w-5" />
            Legal Terms & Conditions
          </CardTitle>
          <CardDescription>
            Manage terms and conditions that customers must accept during checkout
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* Terms Requirement Toggle */}
          <div className="flex items-center justify-between p-4 border rounded-lg">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <Shield className="h-4 w-4 text-primary" />
                <span className="font-medium">Require Terms Acceptance</span>
              </div>
              <p className="text-sm text-muted-foreground">
                When enabled, customers must accept terms before completing checkout
              </p>
            </div>
            <Switch
              checked={requireAcceptance}
              onCheckedChange={setRequireAcceptance}
            />
          </div>

          {/* Terms Content Editor */}
          <div className="space-y-2">
            <Label htmlFor="terms-content">Terms and Conditions Content</Label>
            <Textarea
              id="terms-content"
              value={termsContent}
              onChange={(e) => setTermsContent(e.target.value)}
              placeholder="Enter your terms and conditions here. HTML formatting is supported."
              className="min-h-[300px] font-mono text-sm"
            />
            <div className="text-xs text-muted-foreground">
              HTML tags are supported for formatting (e.g., &lt;h2&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;ul&gt;, etc.)
            </div>
          </div>

          {/* Status Alerts */}
          {requireAcceptance && !termsContent.trim() && (
            <Alert className="border-amber-200 bg-amber-50">
              <AlertCircle className="h-4 w-4 text-amber-600" />
              <AlertDescription className="text-amber-800">
                You have enabled terms requirement but no content is provided. 
                Customers won't be able to complete checkout until terms content is added.
              </AlertDescription>
            </Alert>
          )}

          {requireAcceptance && termsContent.trim() && (
            <Alert className="border-green-200 bg-green-50">
              <CheckCircle className="h-4 w-4 text-green-600" />
              <AlertDescription className="text-green-800">
                Terms acceptance is enabled and content is available. 
                Customers will be required to accept terms during checkout.
              </AlertDescription>
            </Alert>
          )}

          {!requireAcceptance && (
            <Alert>
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>
                Terms acceptance is currently disabled. Customers can complete checkout without accepting terms.
              </AlertDescription>
            </Alert>
          )}

          {/* Save Button */}
          <Button
            onClick={handleSave}
            disabled={isSaving}
            className="w-full"
            size="lg"
          >
            {isSaving ? (
              <>
                <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                Saving Terms Settings...
              </>
            ) : (
              <>
                <Save className="h-4 w-4 mr-2" />
                Save Terms Settings
              </>
            )}
          </Button>
        </CardContent>
      </Card>

      {/* Preview Section */}
      {termsContent.trim() && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Preview</CardTitle>
            <CardDescription>
              This is how the terms will appear to customers
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="border rounded-lg p-4 bg-muted/50 max-h-60 overflow-y-auto">
              <div 
                className="prose prose-sm max-w-none"
                dangerouslySetInnerHTML={{ __html: termsContent }}
              />
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};