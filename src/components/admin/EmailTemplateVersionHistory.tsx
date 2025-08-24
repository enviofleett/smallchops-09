
import React, { useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Alert, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { 
  History, 
  RotateCcw, 
  Eye,
  Calendar,
  User,
  ChevronDown,
  ChevronRight
} from 'lucide-react';
import { formatDistanceToNow } from 'date-fns';

interface TemplateVersion {
  id: string;
  template_id: string;
  version_number: number;
  snapshot: any;
  changed_by: string | null;
  changed_at: string;
}

interface EmailTemplateVersionHistoryProps {
  templateId: string;
  onRestore?: () => void;
}

export const EmailTemplateVersionHistory: React.FC<EmailTemplateVersionHistoryProps> = ({
  templateId,
  onRestore
}) => {
  const [expandedVersion, setExpandedVersion] = useState<number | null>(null);
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const versionsQuery = useQuery<TemplateVersion[]>({
    queryKey: ['email-template-versions', templateId],
    queryFn: async () => {
      // Temporarily return empty array since table doesn't exist yet
      console.log('Version history table not available yet');
      return [] as TemplateVersion[];
    },
    enabled: !!templateId
  });

  const restoreMutation = useMutation({
    mutationFn: async (version: TemplateVersion) => {
      const snapshot = version.snapshot;
      
      const { error } = await supabase
        .from('enhanced_email_templates')
        .update({
          template_name: snapshot.template_name,
          subject_template: snapshot.subject_template,
          html_template: snapshot.html_template,
          text_template: snapshot.text_template,
          variables: snapshot.variables,
          template_type: snapshot.template_type,
          category: snapshot.category,
          style: snapshot.style,
          is_active: snapshot.is_active,
        })
        .eq('id', templateId);

      if (error) throw error;
      return version;
    },
    onSuccess: (version) => {
      queryClient.invalidateQueries({ queryKey: ['email-templates'] });
      queryClient.invalidateQueries({ queryKey: ['email-template-versions', templateId] });
      onRestore?.();
      toast({
        title: "Template Restored",
        description: `Successfully restored to version ${version.version_number}`,
      });
    },
    onError: (error: any) => {
      toast({
        title: "Restore Failed",
        description: error.message || "Failed to restore template version",
        variant: "destructive",
      });
    }
  });

  const toggleExpansion = (versionNumber: number) => {
    setExpandedVersion(expandedVersion === versionNumber ? null : versionNumber);
  };

  if (versionsQuery.isLoading) {
    return (
      <Card>
        <CardContent className="p-6">
          <div className="flex items-center justify-center">
            <div className="text-sm text-muted-foreground">Loading version history...</div>
          </div>
        </CardContent>
      </Card>
    );
  }

  if (versionsQuery.error) {
    return (
      <Alert variant="destructive">
        <AlertDescription>
          Failed to load version history: {(versionsQuery.error as Error).message}
        </AlertDescription>
      </Alert>
    );
  }

  const versions = versionsQuery.data || [];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <History className="h-5 w-5" />
          Version History
        </CardTitle>
        <CardDescription>
          View and restore previous versions of this email template
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {versions.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground">
            No version history available
          </div>
        ) : (
          <div className="space-y-3">
            {versions.map((version) => (
              <div key={version.id} className="border rounded-lg p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => toggleExpansion(version.version_number)}
                      className="h-6 w-6 p-0"
                    >
                      {expandedVersion === version.version_number ? (
                        <ChevronDown className="h-4 w-4" />
                      ) : (
                        <ChevronRight className="h-4 w-4" />
                      )}
                    </Button>
                    
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">
                        v{version.version_number}
                      </Badge>
                      {version.version_number === versions[0]?.version_number && (
                        <Badge variant="default">Current</Badge>
                      )}
                    </div>
                    
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Calendar className="h-3 w-3" />
                      {formatDistanceToNow(new Date(version.changed_at), { addSuffix: true })}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {version.version_number !== versions[0]?.version_number && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => restoreMutation.mutate(version)}
                        disabled={restoreMutation.isPending}
                      >
                        <RotateCcw className="h-4 w-4 mr-1" />
                        Restore
                      </Button>
                    )}
                  </div>
                </div>
                
                {expandedVersion === version.version_number && (
                  <div className="mt-4 space-y-3 border-t pt-4">
                    <div className="grid gap-3 text-sm">
                      <div>
                        <strong>Template Name:</strong> {version.snapshot.template_name}
                      </div>
                      <div>
                        <strong>Subject:</strong> {version.snapshot.subject_template}
                      </div>
                      <div>
                        <strong>Type:</strong> {version.snapshot.template_type}
                      </div>
                      <div>
                        <strong>Category:</strong> {version.snapshot.category}
                      </div>
                      {version.snapshot.variables && version.snapshot.variables.length > 0 && (
                        <div>
                          <strong>Variables:</strong> {version.snapshot.variables.join(', ')}
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};
