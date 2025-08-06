// Utility function to format delivery addresses consistently across the app

export interface DeliveryAddress {
  address_line_1?: string;
  address_line_2?: string;
  city?: string;
  state?: string;
  country?: string;
  postal_code?: string;
  landmark?: string;
}

export const formatAddress = (address: any): string => {
  if (!address) return 'N/A';
  
  // If it's already a string, return it
  if (typeof address === 'string') {
    // Try to parse if it looks like JSON
    if (address.startsWith('{') && address.endsWith('}')) {
      try {
        address = JSON.parse(address);
      } catch {
        return address;
      }
    } else {
      return address;
    }
  }
  
  // If it's an object, format it properly
  if (typeof address === 'object') {
    const addr = address as DeliveryAddress;
    const parts: string[] = [];
    
    if (addr.address_line_1?.trim()) {
      parts.push(addr.address_line_1.trim());
    }
    
    if (addr.address_line_2?.trim()) {
      parts.push(addr.address_line_2.trim());
    }
    
    if (addr.landmark?.trim()) {
      parts.push(`Near ${addr.landmark.trim()}`);
    }
    
    if (addr.city?.trim()) {
      parts.push(addr.city.trim());
    }
    
    if (addr.state?.trim()) {
      parts.push(addr.state.trim());
    }
    
    if (addr.country?.trim() && addr.country.trim() !== 'Nigeria') {
      parts.push(addr.country.trim());
    }
    
    if (addr.postal_code?.trim()) {
      parts.push(addr.postal_code.trim());
    }
    
    return parts.length > 0 ? parts.join(', ') : 'N/A';
  }
  
  return 'N/A';
};

export const formatAddressMultiline = (address: any): string => {
  if (!address) return 'N/A';
  
  // If it's already a string, return it
  if (typeof address === 'string') {
    // Try to parse if it looks like JSON
    if (address.startsWith('{') && address.endsWith('}')) {
      try {
        address = JSON.parse(address);
      } catch {
        return address;
      }
    } else {
      return address;
    }
  }
  
  // If it's an object, format it properly with line breaks
  if (typeof address === 'object') {
    const addr = address as DeliveryAddress;
    const lines: string[] = [];
    
    if (addr.address_line_1?.trim()) {
      lines.push(addr.address_line_1.trim());
    }
    
    if (addr.address_line_2?.trim()) {
      lines.push(addr.address_line_2.trim());
    }
    
    if (addr.landmark?.trim()) {
      lines.push(`Near ${addr.landmark.trim()}`);
    }
    
    const cityStateLine: string[] = [];
    if (addr.city?.trim()) {
      cityStateLine.push(addr.city.trim());
    }
    if (addr.state?.trim()) {
      cityStateLine.push(addr.state.trim());
    }
    if (addr.postal_code?.trim()) {
      cityStateLine.push(addr.postal_code.trim());
    }
    
    if (cityStateLine.length > 0) {
      lines.push(cityStateLine.join(', '));
    }
    
    if (addr.country?.trim() && addr.country.trim() !== 'Nigeria') {
      lines.push(addr.country.trim());
    }
    
    return lines.length > 0 ? lines.join('\n') : 'N/A';
  }
  
  return 'N/A';
};