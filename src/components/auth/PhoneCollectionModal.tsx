import React, { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

interface PhoneCollectionModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSubmit: (phone: string) => Promise<void>;
  userEmail?: string;
}

export const PhoneCollectionModal = ({ 
  isOpen, 
  onClose, 
  onSubmit, 
  userEmail 
}: PhoneCollectionModalProps) => {
  const [phone, setPhone] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();

  const formatNigerianPhone = (value: string) => {
    // Remove all non-digits
    const cleaned = value.replace(/\D/g, '');
    
    // If starts with 234, remove it and add 0
    if (cleaned.startsWith('234')) {
      return '0' + cleaned.slice(3);
    }
    
    // If starts with +234, remove it and add 0
    if (value.startsWith('+234')) {
      return '0' + cleaned.slice(3);
    }
    
    // If doesn't start with 0, add it
    if (cleaned.length > 0 && !cleaned.startsWith('0')) {
      return '0' + cleaned;
    }
    
    return cleaned;
  };

  const validateNigerianPhone = (phone: string) => {
    const cleaned = phone.replace(/\D/g, '');
    return cleaned.length === 11 && cleaned.startsWith('0');
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatNigerianPhone(e.target.value);
    setPhone(formatted);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!validateNigerianPhone(phone)) {
      toast({
        title: "Invalid phone number",
        description: "Please enter a valid Nigerian phone number (11 digits starting with 0)",
        variant: "destructive",
      });
      return;
    }

    setIsSubmitting(true);
    try {
      await onSubmit(phone);
      toast({
        title: "Phone number updated!",
        description: "Your phone number has been saved successfully.",
      });
      onClose();
    } catch (error: any) {
      console.error('Error updating phone:', error);
      toast({
        title: "Update failed",
        description: error.message || "Failed to update phone number. Please try again.",
        variant: "destructive",
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Complete Your Profile</DialogTitle>
        </DialogHeader>
        
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label htmlFor="phone">Phone Number</Label>
            <p className="text-sm text-muted-foreground">
              We need your phone number to complete your registration for {userEmail}
            </p>
            <Input
              id="phone"
              type="tel"
              placeholder="0801234567"
              value={phone}
              onChange={handlePhoneChange}
              maxLength={11}
              required
            />
            <p className="text-xs text-muted-foreground">
              Format: 11 digits starting with 0 (e.g., 08012345678)
            </p>
          </div>
          
          <div className="flex gap-2 pt-4">
            {/* Removed Skip for Now button to make phone required */}
            <Button
              type="submit"
              disabled={isSubmitting || !validateNigerianPhone(phone)}
              className="w-full"
            >
              {isSubmitting ? "Saving..." : "Complete Registration"}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
};