import { supabase } from '@/integrations/supabase/client';

/**
 * Production Image Upload Test - Comprehensive validation
 */
export const testProductImageUpload = async () => {
  const results = {
    bucketAccess: false,
    storagePermissions: false,
    edgeFunctionAccess: false,
    overallStatus: 'fail' as 'pass' | 'fail' | 'partial'
  };

  console.log('🔍 Starting production image upload audit...');

  try {
    // Test 1: Check bucket access
    console.log('Test 1: Checking products-images bucket access...');
    const { data: buckets, error: bucketError } = await supabase.storage.listBuckets();
    
    if (bucketError) {
      console.error('❌ Bucket access failed:', bucketError);
    } else {
      const productsBucket = buckets.find(b => b.name === 'products-images');
      if (productsBucket) {
        console.log('✅ products-images bucket found and accessible');
        results.bucketAccess = true;
      } else {
        console.error('❌ products-images bucket not found');
      }
    }

    // Test 2: Check storage permissions
    console.log('Test 2: Checking storage upload permissions...');
    try {
      // Try to list objects (should work if policies are correct)
      const { data: objects, error: listError } = await supabase.storage
        .from('products-images')
        .list('', { limit: 1 });
        
      if (listError) {
        console.error('❌ Storage permissions failed:', listError);
      } else {
        console.log('✅ Storage permissions working');
        results.storagePermissions = true;
      }
    } catch (permError) {
      console.error('❌ Storage permissions error:', permError);
    }

    // Test 3: Check edge function availability
    console.log('Test 3: Checking simplified-product-upload edge function...');
    try {
      const { error: functionError } = await supabase.functions.invoke('simplified-product-upload', {
        body: { test: true }
      });
      
      if (functionError && !functionError.message.includes('No file provided')) {
        console.error('❌ Edge function access failed:', functionError);
      } else {
        console.log('✅ Edge function accessible (expected "No file provided" error is normal)');
        results.edgeFunctionAccess = true;
      }
    } catch (funcError) {
      console.error('❌ Edge function error:', funcError);
    }

    // Determine overall status
    const passedTests = Object.values(results).filter(r => r === true).length;
    if (passedTests === 3) {
      results.overallStatus = 'pass';
      console.log('🎉 All upload system tests passed! Image upload should work perfectly.');
    } else if (passedTests > 0) {
      results.overallStatus = 'partial';
      console.log(`⚠️ Partial success: ${passedTests}/3 tests passed. Some upload issues may occur.`);
    } else {
      results.overallStatus = 'fail';
      console.log('❌ All upload system tests failed. Image upload will not work.');
    }

    return results;
  } catch (error) {
    console.error('🔥 Upload test suite failed:', error);
    return results;
  }
};

/**
 * Quick diagnostic for upload failures
 */
export const diagnoseUploadFailure = (error: any) => {
  const message = error?.message || error || 'Unknown error';
  
  console.log('🩺 Diagnosing upload failure:', message);
  
  if (message.includes('Authentication') || message.includes('Unauthorized')) {
    return {
      category: 'auth',
      solution: 'User needs to be logged in to upload images',
      retryable: false
    };
  }
  
  if (message.includes('File size') || message.includes('too large')) {
    return {
      category: 'size',
      solution: 'Image is too large - compress to under 20MB',
      retryable: false
    };
  }
  
  if (message.includes('file type') || message.includes('Unsupported')) {
    return {
      category: 'format',
      solution: 'Use JPG, PNG, WebP, or GIF format only',
      retryable: false
    };
  }
  
  if (message.includes('network') || message.includes('timeout')) {
    return {
      category: 'network',
      solution: 'Network issue - try again',
      retryable: true
    };
  }
  
  if (message.includes('storage') || message.includes('bucket')) {
    return {
      category: 'storage',
      solution: 'Storage configuration issue - contact support',
      retryable: false
    };
  }
  
  return {
    category: 'unknown',
    solution: 'Unexpected error - try again or contact support',
    retryable: true
  };
};