/**
 * Utility to parse product features from various formats
 * Handles: string[], string (JSON), string (comma-separated), or plain string
 */
export function parseProductFeatures(features: string | string[] | any): string[] {
  if (!features) return [];
  
  if (Array.isArray(features)) {
    return features.filter(f => f && typeof f === 'string');
  }
  
  if (typeof features === 'string') {
    try {
      const parsed = JSON.parse(features);
      if (Array.isArray(parsed)) {
        return parsed.filter(f => f && typeof f === 'string');
      }
      return [String(parsed)];
    } catch {
      // Not JSON, check if comma-separated
      if (features.includes(',')) {
        return features.split(',').map(f => f.trim()).filter(f => f);
      }
      // Single feature
      return [features];
    }
  }
  
  return [];
}
