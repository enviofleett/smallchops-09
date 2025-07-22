
import React from 'react';
import { X, Clock, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { useContentManagement, type SiteContent } from '@/hooks/useContentManagement';

interface ContentVersionsDialogProps {
  content: SiteContent;
  isOpen: boolean;
  onClose: () => void;
}

export const ContentVersionsDialog = ({ content, isOpen, onClose }: ContentVersionsDialogProps) => {
  const { useContentById } = useContentManagement();
  const { data, isLoading } = useContentById(content.id, true);

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-3xl max-h-[80vh] overflow-hidden flex flex-col">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="flex items-center justify-between">
            Version History: {content.title}
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </DialogTitle>
        </DialogHeader>

        <div className="flex-1 overflow-auto">
          {isLoading ? (
            <div className="text-center py-8">Loading versions...</div>
          ) : (
            <div className="space-y-4">
              {data?.versions?.map((version) => (
                <div key={version.id} className="border rounded-lg p-4">
                  <div className="flex items-center justify-between mb-2">
                    <div className="flex items-center gap-2">
                      <Badge variant="outline">Version {version.version}</Badge>
                      <span className="text-sm text-gray-500 flex items-center gap-1">
                        <Clock className="h-3 w-3" />
                        {new Date(version.created_at).toLocaleString()}
                      </span>
                    </div>
                    {version.change_summary && (
                      <Badge variant="secondary">{version.change_summary}</Badge>
                    )}
                  </div>
                  
                  <h4 className="font-medium mb-2">{version.title}</h4>
                  
                  <div 
                    className="prose prose-sm max-w-none text-sm text-gray-600 line-clamp-3"
                    dangerouslySetInnerHTML={{ __html: version.content }}
                  />
                </div>
              )) || (
                <div className="text-center py-8 text-gray-500">
                  No version history available
                </div>
              )}
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
};
