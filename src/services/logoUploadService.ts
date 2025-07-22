
import { supabase } from "@/integrations/supabase/client";

export const uploadLogo = async (file: File): Promise<string> => {
  console.log("Uploading logo file...", file.name, file.type, file.size);
  
  // Validate file type
  if (!file.type.startsWith('image/')) {
    throw new Error('Please select a valid image file (PNG, JPG, WebP)');
  }

  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File size must be less than 5MB');
  }
  
  // Create a unique filename
  const fileExt = file.name.split('.').pop();
  const fileName = `logo-${Date.now()}.${fileExt}`;
  
  console.log("Uploading to bucket 'business-logos' with filename:", fileName);
  
  // Upload file to Supabase storage
  const { data: uploadData, error: uploadError } = await supabase.storage
    .from('business-logos')
    .upload(fileName, file, {
      cacheControl: '3600',
      upsert: false
    });

  if (uploadError) {
    console.error("Logo upload error:", uploadError);
    throw new Error(`Failed to upload logo: ${uploadError.message}`);
  }

  console.log("File uploaded successfully:", uploadData);

  // Get the public URL
  const { data: urlData } = supabase.storage
    .from('business-logos')
    .getPublicUrl(uploadData.path);

  console.log("Logo uploaded successfully:", urlData.publicUrl);
  
  return urlData.publicUrl;
};
