
import React, { useState, useEffect } from 'react';
import { useMutation, useQueryClient } from '@tanstack/react-query';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CustomerCommunicationPreference, updateCustomerPreference, UpdateCustomerCommunicationPreference } from '@/api/customerPreferences';

interface EditPreferenceDialogProps {
  preference: CustomerCommunicationPreference | null;
  isOpen: boolean;
  onClose: () => void;
}

const EditPreferenceDialog: React.FC<EditPreferenceDialogProps> = ({ preference, isOpen, onClose }) => {
  const [formData, setFormData] = useState<UpdateCustomerCommunicationPreference>({});
  const queryClient = useQueryClient();

  useEffect(() => {
    if (preference) {
      setFormData({
        allow_order_updates: preference.allow_order_updates,
        allow_promotions: preference.allow_promotions,
        preferred_channel: preference.preferred_channel,
        language: preference.language,
      });
    }
  }, [preference]);

  const mutation = useMutation({
    mutationFn: updateCustomerPreference,
    onSuccess: () => {
      toast.success('Preferences updated successfully!');
      queryClient.invalidateQueries({ queryKey: ['customerPreferences'] });
      onClose();
    },
    onError: (error) => {
      toast.error(`Failed to update preferences: ${error.message}`);
    },
  });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!preference) return;
    mutation.mutate({ id: preference.id, updates: formData });
  };

  const handleValueChange = (field: keyof UpdateCustomerCommunicationPreference, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };
  
  if (!preference) return null;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Edit Preferences for {preference.customer_email}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 py-4">
          <div className="flex items-center justify-between">
            <Label htmlFor="allow_order_updates">Allow Order Updates</Label>
            <Switch id="allow_order_updates" checked={formData.allow_order_updates ?? true} onCheckedChange={(c) => handleValueChange('allow_order_updates', c)} />
          </div>
          <div className="flex items-center justify-between">
            <Label htmlFor="allow_promotions">Allow Promotions</Label>
            <Switch id="allow_promotions" checked={formData.allow_promotions ?? true} onCheckedChange={(c) => handleValueChange('allow_promotions', c)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="preferred_channel">Preferred Channel</Label>
            <Select value={formData.preferred_channel ?? 'any'} onValueChange={(v) => handleValueChange('preferred_channel', v)}>
              <SelectTrigger id="preferred_channel">
                <SelectValue placeholder="Select channel..." />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="any">Any</SelectItem>
                <SelectItem value="email">Email</SelectItem>
                <SelectItem value="sms">SMS</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="language">Language Code</Label>
            <Input id="language" value={formData.language ?? 'en'} onChange={(e) => handleValueChange('language', e.target.value)} />
          </div>
          <DialogFooter>
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            <Button type="submit" disabled={mutation.isPending}>
              {mutation.isPending ? 'Saving...' : 'Save Changes'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
};

export default EditPreferenceDialog;
