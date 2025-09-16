import React from 'react';
import { sanitizeHtml } from '@/utils/htmlSanitizer';

interface SafeHtmlProps {
  children: string;
  className?: string;
}

/**
 * Component wrapper for safe HTML rendering
 * Use this instead of dangerouslySetInnerHTML
 */
export const SafeHtml = ({ children, className }: SafeHtmlProps) => {
  const sanitizedContent = sanitizeHtml(children);
  
  return (
    <div 
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitizedContent }}
    />
  );
};