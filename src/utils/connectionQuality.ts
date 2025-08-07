/**
 * Utility to detect and monitor network connection quality
 */

export type ConnectionQuality = 'excellent' | 'good' | 'poor' | 'offline';

interface ConnectionInfo {
  quality: ConnectionQuality;
  effectiveType?: string;
  downlink?: number;
  rtt?: number;
  saveData?: boolean;
}

/**
 * Detects current connection quality based on Network Information API
 */
export const detectConnectionQuality = (): ConnectionInfo => {
  // Check if online
  if (!navigator.onLine) {
    return { quality: 'offline' };
  }

  // Use Network Information API if available
  const connection = (navigator as any).connection || 
                    (navigator as any).mozConnection || 
                    (navigator as any).webkitConnection;

  if (!connection) {
    // Fallback: assume good connection if API not available
    return { quality: 'good' };
  }

  const { effectiveType, downlink, rtt, saveData } = connection;

  let quality: ConnectionQuality = 'good'; // default

  // Determine quality based on effective connection type
  if (effectiveType) {
    switch (effectiveType) {
      case 'slow-2g':
      case '2g':
        quality = 'poor';
        break;
      case '3g':
        quality = downlink && downlink > 1.5 ? 'good' : 'poor';
        break;
      case '4g':
      case '5g':
        quality = 'excellent';
        break;
      default:
        quality = 'good';
    }
  }

  // Adjust based on specific metrics
  if (rtt && rtt > 2000) {
    quality = 'poor';
  } else if (rtt && rtt > 1000) {
    quality = quality === 'excellent' ? 'good' : quality;
  }

  if (downlink && downlink < 0.5) {
    quality = 'poor';
  } else if (downlink && downlink > 10) {
    quality = quality === 'poor' ? 'good' : 'excellent';
  }

  return {
    quality,
    effectiveType,
    downlink,
    rtt,
    saveData
  };
};

/**
 * Gets recommended upload settings based on connection quality
 */
export const getUploadSettings = (connectionInfo: ConnectionInfo) => {
  switch (connectionInfo.quality) {
    case 'poor':
      return {
        maxFileSize: 2 * 1024 * 1024, // 2MB
        quality: 0.6,
        maxDimension: 800,
        timeout: 120000, // 2 minutes
        retryDelay: 5000,
        maxRetries: 2
      };
    case 'good':
      return {
        maxFileSize: 5 * 1024 * 1024, // 5MB
        quality: 0.8,
        maxDimension: 1000,
        timeout: 60000, // 1 minute
        retryDelay: 3000,
        maxRetries: 3
      };
    case 'excellent':
      return {
        maxFileSize: 10 * 1024 * 1024, // 10MB
        quality: 0.9,
        maxDimension: 1200,
        timeout: 45000, // 45 seconds
        retryDelay: 2000,
        maxRetries: 3
      };
    case 'offline':
    default:
      return {
        maxFileSize: 1 * 1024 * 1024, // 1MB
        quality: 0.5,
        maxDimension: 600,
        timeout: 180000, // 3 minutes
        retryDelay: 10000,
        maxRetries: 1
      };
  }
};

/**
 * Monitors connection changes and calls callback with new info
 */
export const monitorConnection = (callback: (info: ConnectionInfo) => void) => {
  const updateConnection = () => {
    callback(detectConnectionQuality());
  };

  // Listen for online/offline events
  window.addEventListener('online', updateConnection);
  window.addEventListener('offline', updateConnection);

  // Listen for connection changes if supported
  const connection = (navigator as any).connection || 
                    (navigator as any).mozConnection || 
                    (navigator as any).webkitConnection;

  if (connection) {
    connection.addEventListener('change', updateConnection);
  }

  // Initial check
  updateConnection();

  // Return cleanup function
  return () => {
    window.removeEventListener('online', updateConnection);
    window.removeEventListener('offline', updateConnection);
    if (connection) {
      connection.removeEventListener('change', updateConnection);
    }
  };
};

/**
 * Creates a connection-aware timeout
 */
export const createAdaptiveTimeout = (baseTimeout: number): number => {
  const connection = detectConnectionQuality();
  const settings = getUploadSettings(connection);
  return settings.timeout;
};

/**
 * Determines if upload should be allowed based on connection
 */
export const shouldAllowUpload = (fileSize: number): { allowed: boolean; reason?: string } => {
  const connection = detectConnectionQuality();
  
  if (connection.quality === 'offline') {
    return { allowed: false, reason: 'No internet connection' };
  }

  const settings = getUploadSettings(connection);
  
  if (fileSize > settings.maxFileSize) {
    const maxSizeMB = (settings.maxFileSize / (1024 * 1024)).toFixed(1);
    return { 
      allowed: false, 
      reason: `File too large for current connection. Maximum: ${maxSizeMB}MB` 
    };
  }

  return { allowed: true };
};