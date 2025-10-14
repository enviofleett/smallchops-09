import React from 'react';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { AlertCircle, CheckCircle2, AlertTriangle } from 'lucide-react';

interface EmailTemplateValidatorProps {
  htmlTemplate: string;
  subjectTemplate: string;
  variables: string[];
  className?: string;
}

export const EmailTemplateValidator: React.FC<EmailTemplateValidatorProps> = ({
  htmlTemplate,
  subjectTemplate,
  variables,
  className
}) => {
  // Extract variables from templates
  const extractVariables = (text: string): string[] => {
    const regex = /\{\{(\w+)\}\}/g;
    const matches: string[] = [];
    let match;
    while ((match = regex.exec(text)) !== null) {
      if (!matches.includes(match[1])) {
        matches.push(match[1]);
      }
    }
    return matches;
  };

  const htmlVars = extractVariables(htmlTemplate);
  const subjectVars = extractVariables(subjectTemplate);
  const usedVariables = [...new Set([...htmlVars, ...subjectVars])];
  const declaredVariables = variables.filter(Boolean);

  // Validation checks
  const missingDeclarations = usedVariables.filter(v => !declaredVariables.includes(v));
  const unusedDeclarations = declaredVariables.filter(v => !usedVariables.includes(v));
  
  const hasErrors = missingDeclarations.length > 0;
  const hasWarnings = unusedDeclarations.length > 0;
  const isValid = !hasErrors;

  if (usedVariables.length === 0 && declaredVariables.length === 0) {
    return (
      <Alert className={className}>
        <AlertTriangle className="h-4 w-4" />
        <AlertDescription>
          No template variables defined. Consider using variables like {`{{customer_name}}`} for dynamic content.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <div className={`space-y-3 ${className}`}>
      {isValid && !hasWarnings && (
        <Alert className="border-green-500 bg-green-50 dark:bg-green-950">
          <CheckCircle2 className="h-4 w-4 text-green-600" />
          <AlertDescription className="text-green-800 dark:text-green-200">
            <strong>Template ready for production</strong> - All variables properly defined
          </AlertDescription>
        </Alert>
      )}

      {hasErrors && (
        <Alert variant="destructive">
          <AlertCircle className="h-4 w-4" />
          <AlertDescription>
            <strong>Missing variable declarations:</strong> These variables are used in your template but not declared in the "Template Variables" field:
            <div className="flex flex-wrap gap-1 mt-2">
              {missingDeclarations.map(v => (
                <Badge key={v} variant="destructive" className="font-mono">{v}</Badge>
              ))}
            </div>
            <p className="mt-2 text-xs">Add these to "Template Variables" field to ensure proper email rendering.</p>
          </AlertDescription>
        </Alert>
      )}

      {hasWarnings && (
        <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950">
          <AlertTriangle className="h-4 w-4 text-amber-600" />
          <AlertDescription className="text-amber-800 dark:text-amber-200">
            <strong>Unused declarations:</strong> These variables are declared but not used in your templates:
            <div className="flex flex-wrap gap-1 mt-2">
              {unusedDeclarations.map(v => (
                <Badge key={v} variant="outline" className="font-mono border-amber-500">{v}</Badge>
              ))}
            </div>
            <p className="mt-2 text-xs">These can be removed or used in your templates with {`{{variable_name}}`} syntax.</p>
          </AlertDescription>
        </Alert>
      )}

      {usedVariables.length > 0 && (
        <div className="p-3 bg-muted rounded-lg">
          <h4 className="text-sm font-semibold mb-2">Template Variables Used:</h4>
          <div className="flex flex-wrap gap-1">
            {usedVariables.map(v => {
              const isDeclared = declaredVariables.includes(v);
              return (
                <Badge 
                  key={v} 
                  variant={isDeclared ? "default" : "destructive"}
                  className="font-mono"
                >
                  {v} {isDeclared ? '✓' : '✗'}
                </Badge>
              );
            })}
          </div>
        </div>
      )}
    </div>
  );
};
