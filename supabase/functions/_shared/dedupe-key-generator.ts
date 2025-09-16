/**
 * Production-Ready Dedupe Key Generator
 * Standardizes dedupe key generation across all Edge Functions
 */

export interface DedupeKeyOptions {
  includeTimestamp?: boolean;
  includeUniqueId?: boolean;
  customSuffix?: string;
  includeMicroseconds?: boolean;
}

/**
 * Generates a safe, unique dedupe key with multiple entropy sources
 */
export function generateSafeDedupeKey(
  baseKey: string,
  options: DedupeKeyOptions = {}
): string {
  const {
    includeTimestamp = true,
    includeUniqueId = true,
    customSuffix = '',
    includeMicroseconds = true
  } = options;

  let key = baseKey;

  if (includeTimestamp) {
    const timestamp = Math.floor(Date.now() / 1000); // Unix timestamp
    key += `|${timestamp}`;
  }

  if (includeMicroseconds) {
    const microseconds = Math.floor(Date.now() * 1000) % 1000000; // Microsecond component
    key += `|${microseconds}`;
  }

  if (includeUniqueId) {
    const uuid = crypto.randomUUID();
    key += `|${uuid}`;
  }

  if (customSuffix) {
    key += `|${customSuffix}`;
  }

  // Add process ID for additional uniqueness in multi-instance scenarios
  const processId = Math.floor(Math.random() * 10000);
  key += `|${processId}`;

  return key;
}

/**
 * Generates communication event specific dedupe key
 */
export function generateCommunicationDedupeKey(
  orderId: string | null,
  eventType: string,
  templateKey: string | null,
  recipientEmail: string,
  options: DedupeKeyOptions = {}
): string {
  const baseKey = [
    orderId || 'no-order',
    eventType,
    templateKey || 'no-template', 
    recipientEmail
  ].join('|');

  return generateSafeDedupeKey(baseKey, options);
}

/**
 * Validates dedupe key format and length
 */
export function validateDedupeKey(key: string): { isValid: boolean; reason?: string } {
  if (!key || typeof key !== 'string') {
    return { isValid: false, reason: 'Dedupe key must be a non-empty string' };
  }

  if (key.length > 500) {
    return { isValid: false, reason: 'Dedupe key too long (max 500 characters)' };
  }

  if (key.includes('..')) {
    return { isValid: false, reason: 'Dedupe key contains consecutive dots' };
  }

  return { isValid: true };
}

/**
 * Creates a fallback dedupe key if primary generation fails
 */
export function createFallbackDedupeKey(
  operation: string,
  identifier: string
): string {
  const timestamp = Date.now();
  const randomSuffix = Math.random().toString(36).substring(2, 15);
  return `fallback|${operation}|${identifier}|${timestamp}|${randomSuffix}`;
}