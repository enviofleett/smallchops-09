import React from 'react';
import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/integrations/supabase/client';
import { Card } from '@/components/ui/card';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { CheckCircle2, XCircle, AlertTriangle, Loader2 } from 'lucide-react';

export const EmailProductionValidator: React.FC = () => {
  const { data: templates, isLoading } = useQuery({
    queryKey: ['email-templates-validation'],
    queryFn: async () => {
      const { data, error } = await supabase
        .from('enhanced_email_templates')
        .select('*')
        .eq('is_active', true);
      if (error) throw error;
      return data;
    }
  });

  const validateTemplate = (template: any) => {
    const issues: string[] = [];
    
    // Extract variables from templates
    const extractVars = (text: string): string[] => {
      const regex = /\{\{(\w+)\}\}/g;
      const vars: string[] = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        if (!vars.includes(match[1])) vars.push(match[1]);
      }
      return vars;
    };

    const htmlVars = extractVars(template.html_template || '');
    const subjectVars = extractVars(template.subject_template || '');
    const usedVars = [...new Set([...htmlVars, ...subjectVars])];
    const declaredVars = template.variables || [];

    const missingDeclarations = usedVars.filter(v => !declaredVars.includes(v));
    
    if (!template.subject_template?.trim()) {
      issues.push('Missing subject template');
    }
    if (!template.html_template?.trim()) {
      issues.push('Missing HTML template');
    }
    if (missingDeclarations.length > 0) {
      issues.push(`Undeclared variables: ${missingDeclarations.join(', ')}`);
    }

    return {
      isValid: issues.length === 0,
      issues,
      variableCount: usedVars.length
    };
  };

  if (isLoading) {
    return (
      <Card className="p-6">
        <div className="flex items-center gap-2">
          <Loader2 className="h-4 w-4 animate-spin" />
          <span>Validating templates...</span>
        </div>
      </Card>
    );
  }

  const validationResults = templates?.map(t => ({
    template: t,
    validation: validateTemplate(t)
  })) || [];

  const validTemplates = validationResults.filter(r => r.validation.isValid);
  const invalidTemplates = validationResults.filter(r => !r.validation.isValid);
  const allValid = invalidTemplates.length === 0;

  return (
    <Card className="p-6 space-y-4">
      <h3 className="text-lg font-semibold">Production Readiness Check</h3>
      
      {allValid ? (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>All {validTemplates.length} active templates are production-ready</strong>
            <p className="text-sm mt-1">All templates have proper HTML, subjects, and variable declarations.</p>
          </AlertDescription>
        </Alert>
      ) : (
        <Alert variant="destructive">
          <XCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>{invalidTemplates.length} template(s) have issues</strong>
            <p className="text-sm mt-1">Fix these issues before deploying to production.</p>
          </AlertDescription>
        </Alert>
      )}

      {invalidTemplates.length > 0 && (
        <div className="space-y-3">
          <h4 className="text-sm font-semibold text-destructive">Templates with Issues:</h4>
          {invalidTemplates.map(({ template, validation }) => (
            <div key={template.id} className="p-3 border border-destructive rounded-lg">
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="font-medium">{template.template_name}</p>
                  <code className="text-xs text-muted-foreground">{template.template_key}</code>
                </div>
                <Badge variant="destructive">Invalid</Badge>
              </div>
              <ul className="text-sm space-y-1 text-muted-foreground">
                {validation.issues.map((issue, idx) => (
                  <li key={idx} className="flex items-start gap-2">
                    <AlertTriangle className="h-4 w-4 text-destructive flex-shrink-0 mt-0.5" />
                    <span>{issue}</span>
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      {validTemplates.length > 0 && (
        <div className="space-y-2">
          <h4 className="text-sm font-semibold text-green-600">Valid Templates:</h4>
          <div className="flex flex-wrap gap-2">
            {validTemplates.map(({ template, validation }) => (
              <Badge key={template.id} variant="outline" className="border-green-500">
                <CheckCircle2 className="h-3 w-3 mr-1 text-green-600" />
                {template.template_key} ({validation.variableCount} vars)
              </Badge>
            ))}
          </div>
        </div>
      )}
    </Card>
  );
};
