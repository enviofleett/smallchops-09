// Promotion Code Normalization Service
// Ensures consistent promotion code handling across frontend and backend

import { logger } from '@/lib/logger';

export class PromotionNormalizer {
  /**
   * Normalize promotion code for consistent processing
   * CRITICAL: Matches server-side normalization logic
   */
  static normalizeCode(code: string | null | undefined): string | null {
    if (!code || typeof code !== 'string') {
      return null;
    }

    const normalized = code
      .trim()
      .toUpperCase()
      .replace(/\s+/g, '') // Remove all whitespace
      .replace(/[^A-Z0-9]/g, ''); // Remove special characters except alphanumeric

    // Validate normalized code
    if (normalized.length < 2 || normalized.length > 20) {
      logger.warn('Invalid promotion code length:', { original: code, normalized });
      return null;
    }

    return normalized;
  }

  /**
   * Validate promotion code format
   */
  static isValidFormat(code: string): boolean {
    if (!code || typeof code !== 'string') return false;
    
    const normalized = this.normalizeCode(code);
    return normalized !== null && /^[A-Z0-9]{2,20}$/.test(normalized);
  }

  /**
   * Generate user-friendly error messages for invalid codes
   */
  static getValidationError(code: string | null | undefined): string | null {
    if (!code || typeof code !== 'string') {
      return 'Please enter a promotion code';
    }

    const trimmed = code.trim();
    if (trimmed.length === 0) {
      return 'Please enter a promotion code';
    }

    if (trimmed.length < 2) {
      return 'Promotion code must be at least 2 characters long';
    }

    if (trimmed.length > 20) {
      return 'Promotion code cannot exceed 20 characters';
    }

    const normalized = this.normalizeCode(code);
    if (!normalized) {
      return 'Promotion code contains invalid characters. Use only letters and numbers.';
    }

    return null; // Valid
  }

  /**
   * Prepare promotion code for server validation
   * Returns normalized code or null with validation error
   */
  static prepareForValidation(code: string | null | undefined): {
    normalizedCode: string | null;
    error: string | null;
  } {
    const error = this.getValidationError(code);
    if (error) {
      return { normalizedCode: null, error };
    }

    const normalizedCode = this.normalizeCode(code);
    return { normalizedCode, error: null };
  }

  /**
   * Log promotion code usage for analytics
   */
  static logUsage(originalCode: string, normalizedCode: string, success: boolean, discountAmount?: number) {
    logger.info('Promotion code usage', {
      originalCode,
      normalizedCode,
      success,
      discountAmount,
      codeChanged: originalCode !== normalizedCode,
      timestamp: new Date().toISOString()
    });
  }
}