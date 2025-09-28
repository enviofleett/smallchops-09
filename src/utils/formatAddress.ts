// PRODUCTION-SAFE Address Formatting Utility
// Prevents React error #31 by ensuring safe string conversion of address objects

export interface DeliveryAddress {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  landmark?: string;
}

/**
 * Production-safe address formatter that prevents React rendering errors
 * Handles all possible address formats: objects, strings, JSON, null, undefined
 */
export const formatAddress = (address: any): string => {
  // Handle null, undefined, or empty values
  if (!address) return 'N/A';
  
  // If it's already a string, validate and return
  if (typeof address === 'string') {
    const trimmed = address.trim();
    if (!trimmed) return 'N/A';
    
    // Try to parse if it looks like JSON (safe parsing)
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        // Recursively format the parsed object
        return formatAddress(parsed);
      } catch {
        // If JSON parsing fails, return the string as-is
        return trimmed;
      }
    } else {
      return trimmed;
    }
  }
  
  // Handle object formatting with comprehensive safety checks
  if (typeof address === 'object' && address !== null && !Array.isArray(address)) {
    // Check if it's a nested address structure
    const addr = address.address ? address.address : address;
    const parts: string[] = [];
    
    // Safely extract address components
    if (addr?.address_line_1?.trim()) {
      parts.push(String(addr.address_line_1).trim());
    }
    
    if (addr?.address_line_2?.trim()) {
      parts.push(String(addr.address_line_2).trim());
    }
    
    if (addr?.landmark?.trim()) {
      parts.push(`Near ${String(addr.landmark).trim()}`);
    }
    
    if (addr?.city?.trim()) {
      parts.push(String(addr.city).trim());
    }
    
    if (addr?.state?.trim()) {
      parts.push(String(addr.state).trim());
    }
    
    if (addr?.country?.trim() && String(addr.country).trim() !== 'Nigeria') {
      parts.push(String(addr.country).trim());
    }
    
    if (addr?.postal_code?.trim()) {
      parts.push(String(addr.postal_code).trim());
    }
    
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  }
  
  // Fallback for any other type - convert to string safely
  return String(address).trim() || 'N/A';
};

/**
 * Production-safe multiline address formatter
 * Returns formatted address with line breaks for display
 */
export const formatAddressMultiline = (address: any): string => {
  // Handle null, undefined, or empty values
  if (!address) return 'N/A';
  
  // If it's already a string, validate and return
  if (typeof address === 'string') {
    const trimmed = address.trim();
    if (!trimmed) return 'N/A';
    
    // Try to parse if it looks like JSON
    if (trimmed.startsWith('{') && trimmed.endsWith('}')) {
      try {
        const parsed = JSON.parse(trimmed);
        return formatAddressMultiline(parsed);
      } catch {
        return trimmed;
      }
    } else {
      return trimmed;
    }
  }
  
  // Handle object formatting with line breaks
  if (typeof address === 'object' && address !== null && !Array.isArray(address)) {
    const addr = address.address ? address.address : address;
    const lines: string[] = [];
    
    if (addr?.address_line_1?.trim()) {
      lines.push(String(addr.address_line_1).trim());
    }
    
    if (addr?.address_line_2?.trim()) {
      lines.push(String(addr.address_line_2).trim());
    }
    
    if (addr?.landmark?.trim()) {
      lines.push(`Near ${String(addr.landmark).trim()}`);
    }
    
    const cityStateLine: string[] = [];
    if (addr?.city?.trim()) {
      cityStateLine.push(String(addr.city).trim());
    }
    if (addr?.state?.trim()) {
      cityStateLine.push(String(addr.state).trim());
    }
    if (addr?.postal_code?.trim()) {
      cityStateLine.push(String(addr.postal_code).trim());
    }
    
    if (cityStateLine.length > 0) {
      lines.push(cityStateLine.join(', '));
    }
    
    if (addr?.country?.trim() && String(addr.country).trim() !== 'Nigeria') {
      lines.push(String(addr.country).trim());
    }
    
    return lines.length > 0 ? lines.join('\n') : 'N/A';
  }
  
  // Fallback for any other type
  return String(address).trim() || 'N/A';
};

/**
 * Emergency safe address formatter - never throws errors
 * Use this in error boundaries and critical production code
 */
export const emergencySafeFormatAddress = (address: any): string => {
  try {
    return formatAddress(address);
  } catch (error) {
    console.warn('Address formatting failed, using emergency fallback:', error);
    // Last resort - try to extract anything useful
    if (address && typeof address === 'object') {
      const str = String(address.address_line_1 || address.city || address.address || '').trim();
      return str || 'Address unavailable';
    }
    return 'Address unavailable';
  }
};