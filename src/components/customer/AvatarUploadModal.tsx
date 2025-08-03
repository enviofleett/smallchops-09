import React, { useState, useRef } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Camera, Upload, X, Crop, RotateCw } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { useToast } from '@/hooks/use-toast';
import { useCustomerAuth } from '@/hooks/useCustomerAuth';

interface AvatarUploadModalProps {
  isOpen: boolean;
  onClose: () => void;
  onAvatarUpdate: (avatarUrl: string) => void;
  currentAvatar?: string;
}

export function AvatarUploadModal({ 
  isOpen, 
  onClose, 
  onAvatarUpdate, 
  currentAvatar 
}: AvatarUploadModalProps) {
  const [isUploading, setIsUploading] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const { customerAccount } = useCustomerAuth();

  const handleFileSelect = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast({
        variant: 'destructive',
        title: 'Invalid file type',
        description: 'Please select an image file (PNG, JPG, JPEG)',
      });
      return;
    }

    // Validate file size (max 5MB)
    if (file.size > 5 * 1024 * 1024) {
      toast({
        variant: 'destructive',
        title: 'File too large',
        description: 'Please select an image smaller than 5MB',
      });
      return;
    }

    setSelectedFile(file);
    
    // Create preview URL
    const url = URL.createObjectURL(file);
    setPreviewUrl(url);
  };

  const handleUpload = async () => {
    if (!selectedFile || !customerAccount?.id) return;

    setIsUploading(true);
    try {
      // Create a unique filename
      const fileExt = selectedFile.name.split('.').pop();
      const fileName = `${customerAccount.id}-${Date.now()}.${fileExt}`;
      const filePath = `avatars/${fileName}`;

      // Upload to Supabase Storage
      const { error: uploadError } = await supabase.storage
        .from('avatars')
        .upload(filePath, selectedFile);

      if (uploadError) {
        throw uploadError;
      }

      // Get the public URL
      const { data: { publicUrl } } = supabase.storage
        .from('avatars')
        .getPublicUrl(filePath);

      // Update the avatar URL in the profile
      onAvatarUpdate(publicUrl);
      
      toast({
        title: 'Avatar updated',
        description: 'Your profile photo has been updated successfully',
      });

      handleClose();
    } catch (error: any) {
      console.error('Avatar upload error:', error);
      toast({
        variant: 'destructive',
        title: 'Upload failed',
        description: error.message || 'Failed to upload avatar',
      });
    } finally {
      setIsUploading(false);
    }
  };

  const handleClose = () => {
    setPreviewUrl(null);
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
    onClose();
  };

  const handleRemoveAvatar = async () => {
    try {
      onAvatarUpdate('');
      toast({
        title: 'Avatar removed',
        description: 'Your profile photo has been removed',
      });
      handleClose();
    } catch (error: any) {
      toast({
        variant: 'destructive',
        title: 'Failed to remove avatar',
        description: error.message,
      });
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Camera className="w-5 h-5" />
            Update Profile Photo
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* Current/Preview Avatar */}
          <div className="flex justify-center">
            <Avatar className="w-32 h-32">
              <AvatarImage src={previewUrl || currentAvatar} />
              <AvatarFallback className="text-4xl">
                {customerAccount?.name?.charAt(0)?.toUpperCase() || 'U'}
              </AvatarFallback>
            </Avatar>
          </div>

          {/* File Input */}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            onChange={handleFileSelect}
            className="hidden"
          />

          {/* Action Buttons */}
          <div className="space-y-3">
            {!selectedFile && (
              <>
                <Button
                  onClick={() => fileInputRef.current?.click()}
                  className="w-full"
                  variant="outline"
                >
                  <Upload className="w-4 h-4 mr-2" />
                  Choose Photo
                </Button>
                
                {currentAvatar && (
                  <Button
                    onClick={handleRemoveAvatar}
                    className="w-full"
                    variant="outline"
                  >
                    <X className="w-4 h-4 mr-2" />
                    Remove Current Photo
                  </Button>
                )}
              </>
            )}

            {selectedFile && (
              <div className="space-y-3">
                <div className="text-center">
                  <p className="text-sm text-muted-foreground">
                    Selected: {selectedFile.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {(selectedFile.size / 1024 / 1024).toFixed(2)} MB
                  </p>
                </div>
                
                <div className="flex gap-2">
                  <Button
                    onClick={() => fileInputRef.current?.click()}
                    variant="outline"
                    className="flex-1"
                  >
                    Choose Different
                  </Button>
                  <Button
                    onClick={handleUpload}
                    disabled={isUploading}
                    className="flex-1"
                  >
                    {isUploading ? 'Uploading...' : 'Upload'}
                  </Button>
                </div>
              </div>
            )}
          </div>

          {/* File Requirements */}
          <div className="text-xs text-muted-foreground space-y-1">
            <p>• Maximum file size: 5MB</p>
            <p>• Supported formats: PNG, JPG, JPEG</p>
            <p>• Recommended: Square images (1:1 ratio)</p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}