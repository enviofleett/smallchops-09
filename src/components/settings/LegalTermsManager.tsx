import React, { useState, useEffect, useCallback } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { FileText, Save, AlertCircle, CheckCircle, Shield, Eye, Timer } from 'lucide-react';
import { SafeHtml } from "@/components/ui/safe-html";

export const LegalTermsManager = () => {
  const [termsContent, setTermsContent] = useState('');
  const [originalContent, setOriginalContent] = useState('');
  const [requireAcceptance, setRequireAcceptance] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [lastSaved, setLastSaved] = useState<Date | null>(null);
  const [hasUnsavedChanges, setHasUnsavedChanges] = useState(false);
  const [showConfirmDialog, setShowConfirmDialog] = useState(false);

  // Check for unsaved changes
  useEffect(() => {
    const hasChanges = termsContent !== originalContent;
    setHasUnsavedChanges(hasChanges);
  }, [termsContent, originalContent]);

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!hasUnsavedChanges || isSaving) return;
    
    try {
      await supabase
        .from('content_management')
        .upsert({
          key: 'legal_terms_draft',
          content: termsContent,
          is_published: false,
          updated_at: new Date().toISOString()
        });
    } catch (error) {
      console.error('Auto-save failed:', error);
    }
  }, [termsContent, hasUnsavedChanges, isSaving]);

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(autoSave, 30000);
    return () => clearInterval(interval);
  }, [autoSave]);

  // Validation functions
  const validateContent = () => {
    if (!termsContent.trim()) {
      return { isValid: false, message: 'Terms content cannot be empty' };
    }
    if (termsContent.length < 100) {
      return { isValid: false, message: 'Terms content should be at least 100 characters for legal validity' };
    }
    return { isValid: true, message: '' };
  };

  const getWordCount = () => {
    return termsContent.trim().split(/\s+/).filter(word => word.length > 0).length;
  };

  // Load existing terms settings
  useEffect(() => {
    const loadTermsData = async () => {
      try {
        setIsLoading(true);

        // Load terms content with better error handling
        const { data: termsData, error: termsError } = await supabase
          .from('content_management')
          .select('content, is_published, updated_at')
          .eq('key', 'legal_terms')
          .maybeSingle();

        if (termsError && termsError.code !== 'PGRST116') {
          throw termsError;
        }

        // Load requirement setting
        const { data: requirementData, error: requirementError } = await supabase
          .from('content_management')
          .select('content')
          .eq('key', 'legal_require_terms_acceptance')
          .maybeSingle();

        if (requirementError && requirementError.code !== 'PGRST116') {
          throw requirementError;
        }

        const content = termsData?.content || '';
        setTermsContent(content);
        setOriginalContent(content);
        setRequireAcceptance(requirementData?.content === 'true');

        if (termsData?.updated_at) {
          setLastSaved(new Date(termsData.updated_at));
        }
      } catch (error: any) {
        console.error('Error loading terms data:', error);
        toast.error(`Failed to load terms data: ${error.message}`);
      } finally {
        setIsLoading(false);
      }
    };

    loadTermsData();
  }, []);

  const handleSave = async () => {
    // Validate content before saving
    const validation = validateContent();
    if (!validation.isValid) {
      toast.error(validation.message);
      return;
    }

    // Show confirmation for publishing changes
    if (requireAcceptance && termsContent !== originalContent) {
      setShowConfirmDialog(true);
      return;
    }

    await performSave();
  };

  const performSave = async () => {
    try {
      setIsSaving(true);

      // Save terms content with proper conflict resolution
      const { error: termsError } = await supabase
        .from('content_management')
        .upsert({
          key: 'legal_terms',
          title: 'Terms and Conditions',
          content: termsContent,
          content_type: 'html',
          is_published: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (termsError) throw termsError;

      // Save requirement setting
      const { error: requirementError } = await supabase
        .from('content_management')
        .upsert({
          key: 'legal_require_terms_acceptance',
          title: 'Require Terms Acceptance',
          content: requireAcceptance.toString(),
          content_type: 'text',
          is_published: true,
          updated_at: new Date().toISOString()
        }, {
          onConflict: 'key'
        });

      if (requirementError) throw requirementError;

      // Update state to reflect saved changes
      setOriginalContent(termsContent);
      setLastSaved(new Date());
      setShowConfirmDialog(false);

      toast.success('Legal terms settings published successfully! Changes are now live.');
    } catch (error: any) {
      console.error('Error saving terms:', error);
      toast.error(`Failed to publish changes: ${error.message}`);
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
            <div className="flex items-center justify-between">
              <Label htmlFor="terms-content">Terms and Conditions Content</Label>
              <div className="flex items-center gap-4 text-xs text-muted-foreground">
                <span>{getWordCount()} words</span>
                <span>{termsContent.length} characters</span>
                {hasUnsavedChanges && (
                  <div className="flex items-center gap-1 text-amber-600">
                    <Timer className="h-3 w-3" />
                    <span>Unsaved changes</span>
                  </div>
                )}
                {lastSaved && !hasUnsavedChanges && (
                  <div className="flex items-center gap-1 text-green-600">
                    <CheckCircle className="h-3 w-3" />
                    <span>Saved {lastSaved.toLocaleTimeString()}</span>
                  </div>
                )}
              </div>
            </div>
            <Textarea
              id="terms-content"
              value={termsContent}
              onChange={(e) => setTermsContent(e.target.value)}
              placeholder="Enter your terms and conditions here. HTML formatting is supported."
              className="min-h-[300px] font-mono text-sm"
            />
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>HTML tags are supported for formatting (e.g., &lt;h2&gt;, &lt;p&gt;, &lt;strong&gt;, &lt;ul&gt;, etc.)</span>
              {termsContent.length < 100 && termsContent.length > 0 && (
                <span className="text-amber-600">Minimum 100 characters recommended for legal validity</span>
              )}
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
          <Dialog open={showConfirmDialog} onOpenChange={setShowConfirmDialog}>
            <Button
              onClick={handleSave}
              disabled={isSaving || !hasUnsavedChanges}
              className="w-full"
              size="lg"
              variant={hasUnsavedChanges && requireAcceptance ? "default" : "secondary"}
            >
              {isSaving ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                  Publishing Changes...
                </>
              ) : (
                <>
                  <Save className="h-4 w-4 mr-2" />
                  {hasUnsavedChanges 
                    ? (requireAcceptance ? 'Publish Terms (Live Production)' : 'Save Changes')
                    : 'No Changes to Save'
                  }
                </>
              )}
            </Button>

            <DialogContent>
              <DialogHeader>
                <DialogTitle>Publish Terms to Production?</DialogTitle>
                <DialogDescription>
                  You are about to publish changes to your terms and conditions. These changes will be immediately visible to all customers and required for checkout completion.
                </DialogDescription>
              </DialogHeader>
              
              <div className="space-y-4">
                <Alert className="border-amber-200 bg-amber-50">
                  <AlertCircle className="h-4 w-4 text-amber-600" />
                  <AlertDescription className="text-amber-800">
                    <strong>Production Impact:</strong> All customers will be required to accept the updated terms before completing their orders.
                  </AlertDescription>
                </Alert>

                <div className="text-sm space-y-2">
                  <div><strong>Word Count:</strong> {getWordCount()} words</div>
                  <div><strong>Character Count:</strong> {termsContent.length} characters</div>
                  <div><strong>Terms Required:</strong> {requireAcceptance ? 'Yes' : 'No'}</div>
                </div>
              </div>

              <DialogFooter>
                <Button variant="outline" onClick={() => setShowConfirmDialog(false)}>
                  Cancel
                </Button>
                <Button onClick={performSave} disabled={isSaving}>
                  {isSaving ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white mr-2"></div>
                      Publishing...
                    </>
                  ) : (
                    'Publish to Production'
                  )}
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
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
              <SafeHtml className="prose prose-sm max-w-none">
                {termsContent}
              </SafeHtml>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );
};