import React from 'react';
import { Card } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Mail, Clock } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface EmailTemplate {
  id: string;
  template_key: string;
  template_name: string;
  category?: string;
  is_active: boolean;
  updated_at: string;
}

interface EmailTemplateListProps {
  templates: EmailTemplate[];
  isLoading: boolean;
  selectedTemplateId: string | null;
  onTemplateSelect: (templateId: string) => void;
}

export const EmailTemplateList: React.FC<EmailTemplateListProps> = ({
  templates,
  isLoading,
  selectedTemplateId,
  onTemplateSelect
}) => {
  if (isLoading) {
    return (
      <Card className="p-4 space-y-3">
        {[1, 2, 3, 4, 5].map((i) => (
          <Skeleton key={i} className="h-20 w-full" />
        ))}
      </Card>
    );
  }

  if (templates.length === 0) {
    return (
      <Card className="p-8 text-center">
        <Mail className="h-12 w-12 mx-auto text-muted-foreground mb-3" />
        <p className="text-muted-foreground">No templates found</p>
      </Card>
    );
  }

  return (
    <Card className="p-4 space-y-2 max-h-[calc(100vh-300px)] overflow-y-auto">
      {templates.map((template) => (
        <button
          key={template.id}
          onClick={() => onTemplateSelect(template.id)}
          className={`w-full text-left p-4 rounded-lg border-2 transition-all hover:border-primary ${
            selectedTemplateId === template.id
              ? 'border-primary bg-primary/5'
              : 'border-transparent bg-muted/50'
          }`}
        >
          <div className="flex items-start justify-between mb-2">
            <div className="flex-1">
              <h4 className="font-semibold text-sm mb-1">{template.template_name}</h4>
              <code className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded">
                {template.template_key}
              </code>
            </div>
            <Badge variant={template.is_active ? 'default' : 'secondary'} className="ml-2">
              {template.is_active ? 'Active' : 'Inactive'}
            </Badge>
          </div>

          {template.category && (
            <Badge variant="outline" className="text-xs mb-2">
              {template.category}
            </Badge>
          )}

          <div className="flex items-center gap-1 text-xs text-muted-foreground">
            <Clock className="h-3 w-3" />
            Updated {new Date(template.updated_at).toLocaleDateString()}
          </div>
        </button>
      ))}
    </Card>
  );
};
