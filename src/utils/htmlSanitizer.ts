import DOMPurify from 'dompurify';

// Security configuration for DOMPurify
const SANITIZE_CONFIG = {
  // Allow basic HTML formatting but remove dangerous elements
  ALLOWED_TAGS: [
    'p', 'br', 'strong', 'b', 'em', 'i', 'u', 'ul', 'ol', 'li', 
    'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'blockquote', 'pre', 'code'
  ],
  ALLOWED_ATTR: ['class'],
  FORBID_ATTR: ['style', 'onclick', 'onload', 'onerror'],
  FORBID_TAGS: ['script', 'iframe', 'object', 'embed', 'link', 'style'],
  KEEP_CONTENT: true,
  RETURN_DOM: false,
  RETURN_DOM_FRAGMENT: false,
  RETURN_DOM_IMPORT: false,
};

/**
 * Sanitizes HTML content to prevent XSS attacks
 * Used for product descriptions, email templates, and other user-generated content
 */
export const sanitizeHtml = (html: string): string => {
  if (!html || typeof html !== 'string') {
    return '';
  }
  
  return DOMPurify.sanitize(html, SANITIZE_CONFIG);
};

/**
 * Sanitizes text content for safe display
 * Removes all HTML tags and returns plain text
 */
export const sanitizeText = (text: string): string => {
  if (!text || typeof text !== 'string') {
    return '';
  }
  
  // First sanitize HTML, then strip all remaining tags
  const sanitized = DOMPurify.sanitize(text, { 
    ALLOWED_TAGS: [], 
    KEEP_CONTENT: true 
  });
  
  return sanitized;
};

// Note: SafeHtml component is available in @/components/ui/safe-html.tsx