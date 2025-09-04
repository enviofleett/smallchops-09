import React from 'react';
import { sanitizeHtml } from '@/utils/htmlSanitizer';

interface SafeHtmlProps {
  children?: React.ReactNode;
  className?: string;
  content?: string;
}

/**
 * PRODUCTION-READY Component wrapper for safe HTML rendering
 * Use this instead of dangerouslySetInnerHTML
 * Supports both children prop and content prop for flexibility
 */
export const SafeHtml = ({ children, className, content }: SafeHtmlProps) => {
  // Determine the content to sanitize
  let textContent = '';
  
  if (content) {
    textContent = content;
  } else if (typeof children === 'string') {
    textContent = children;
  } else if (children !== undefined && children !== null) {
    textContent = String(children);
  }
  
  // Handle empty or null content
  if (!textContent || textContent === 'null' || textContent === 'undefined') {
    return <span className={className}>-</span>;
  }
  
  const sanitizedContent = sanitizeHtml(textContent);
  
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};