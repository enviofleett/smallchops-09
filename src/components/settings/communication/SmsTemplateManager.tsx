
import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { PlusCircle, Trash2, Edit } from 'lucide-react';
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog"

interface SmsTemplate {
  id: string;
  name: string;
  body: string;
}

interface SmsTemplateManagerProps {
  templates: SmsTemplate[];
  onTemplatesChange: (templates: SmsTemplate[]) => void;
  loading: boolean;
}

const SmsTemplateManager: React.FC<SmsTemplateManagerProps> = ({ templates, onTemplatesChange, loading }) => {
  const [editingTemplate, setEditingTemplate] = useState<Partial<SmsTemplate> | null>(null);
  const [isNew, setIsNew] = useState(false);

  const handleAddNew = () => {
    setIsNew(true);
    setEditingTemplate({
      id: crypto.randomUUID(),
      name: '',
      body: '',
    });
  };

  const handleEdit = (template: SmsTemplate) => {
    setIsNew(false);
    setEditingTemplate({ ...template });
  };

  const handleSave = () => {
    if (!editingTemplate || !editingTemplate.name) {
      return;
    }
    let updatedTemplates;
    if (isNew) {
      updatedTemplates = [...templates, editingTemplate as SmsTemplate];
    } else {
      updatedTemplates = templates.map(t => t.id === editingTemplate.id ? editingTemplate as SmsTemplate : t);
    }
    onTemplatesChange(updatedTemplates);
    setEditingTemplate(null);
  };

  const handleDelete = (templateId: string) => {
    onTemplatesChange(templates.filter(t => t.id !== templateId));
  };

  const handleFieldChange = (field: keyof Omit<SmsTemplate, 'id'>, value: string) => {
    if (editingTemplate) {
      setEditingTemplate({ ...editingTemplate, [field]: value });
    }
  };

  if (editingTemplate) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{isNew ? 'Add New SMS Template' : 'Edit SMS Template'}</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <Label htmlFor="template_name">Template Name</Label>
            <Input 
              id="template_name" 
              value={editingTemplate.name || ''} 
              onChange={(e) => handleFieldChange('name', e.target.value)}
              disabled={loading}
              placeholder="e.g., Order Shipped"
            />
          </div>
          <div>
            <Label htmlFor="template_body">Body</Label>
            <Textarea
              id="template_body"
              value={editingTemplate.body || ''}
              onChange={(e) => handleFieldChange('body', e.target.value)}
              disabled={loading}
              placeholder="Use variables like {{customer_name}} or {{order_number}}..."
              rows={5}
            />
            <p className="text-sm text-muted-foreground mt-2">
              {"Available variables: `{{customer_name}}`, `{{order_number}}`, `{{tracking_link}}`."}
            </p>
          </div>
          <div className="flex gap-2 pt-2">
            <Button onClick={handleSave} disabled={loading}>Save Template</Button>
            <Button variant="outline" onClick={() => setEditingTemplate(null)} disabled={loading}>Cancel</Button>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex justify-between items-center">
          <CardTitle>Manage SMS Templates</CardTitle>
          <Button size="sm" onClick={handleAddNew} disabled={loading}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Add New
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        {templates.length === 0 ? (
          <p className="text-muted-foreground text-center py-8">No SMS templates created yet.</p>
        ) : (
          <div className="space-y-2">
            {templates.map(template => (
              <div key={template.id} className="flex items-center justify-between p-2 border rounded-md bg-background">
                <span className="font-medium">{template.name}</span>
                <div className="flex gap-1">
                  <Button variant="ghost" size="icon" onClick={() => handleEdit(template)} disabled={loading} aria-label="Edit">
                    <Edit className="h-4 w-4" />
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="ghost" size="icon" disabled={loading} aria-label="Delete">
                        <Trash2 className="h-4 w-4 text-destructive" />
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Are you sure?</AlertDialogTitle>
                        <AlertDialogDescription>
                          This will permanently delete the "{template.name}" template. This action cannot be undone.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                        <AlertDialogAction className="bg-destructive hover:bg-destructive/90" onClick={() => handleDelete(template.id)}>Delete</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default SmsTemplateManager;
