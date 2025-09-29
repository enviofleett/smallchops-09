/**
 * JSON Validation Utilities
 * Provides safe JSON parsing with fallbacks to prevent crashes from invalid data
 */

/**
 * Validates if a value is valid JSON
 * @param value - The value to validate
 * @returns true if valid JSON, false otherwise
 */
export function isValidJSON(value: unknown): boolean {
  if (value === null || value === undefined) {
    return false;
  }

  // Already an object - consider valid
  if (typeof value === 'object') {
    return true;
  }

  // Try to parse string
  if (typeof value !== 'string') {
    return false;
  }

  try {
    JSON.parse(value);
    return true;
  } catch {
    return false;
  }
}

/**
 * Safely parses JSON with fallback
 * @param value - The value to parse
 * @param fallback - Fallback value if parsing fails
 * @returns Parsed value or fallback
 */
export function safeJSONParse<T = any>(
  value: unknown, 
  fallback: T = {} as T
): T {
  if (value === null || value === undefined) {
    return fallback;
  }

  // Already an object - return as-is
  if (typeof value === 'object' && value !== null) {
    return value as T;
  }

  // Try to parse string
  if (typeof value === 'string') {
    try {
      return JSON.parse(value) as T;
    } catch (error) {
      console.warn('JSON parse failed, using fallback:', {
        value: value.substring(0, 100), // Log only first 100 chars
        error: error instanceof Error ? error.message : 'Unknown error'
      });
      return fallback;
    }
  }

  return fallback;
}

/**
 * Safely parses array-type JSON with fallback
 * @param value - The value to parse
 * @returns Parsed array or empty array
 */
export function safeJSONParseArray<T = any>(value: unknown): T[] {
  const parsed = safeJSONParse(value, []);
  return Array.isArray(parsed) ? parsed : [];
}
