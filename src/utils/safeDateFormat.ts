import { format, parseISO, isValid } from 'date-fns';

// Safe date formatting utility
export const safeFormatDate = (dateValue: any, formatString: string = 'PPP'): string => {
  if (!dateValue) return 'N/A';
  if (dateValue === 'null' || dateValue === 'undefined') return 'N/A';
  
  try {
    let date: Date;
    
    if (typeof dateValue === 'string') {
      // Try parsing ISO string first
      date = parseISO(dateValue);
      
      // If parseISO fails, try new Date()
      if (!isValid(date)) {
        date = new Date(dateValue);
      }
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      // Handle other types by converting to string first
      date = new Date(String(dateValue));
    }
    
    // Final validation
    if (!isValid(date) || isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    return format(date, formatString);
  } catch (error) {
    console.warn('Date formatting error:', error, 'for value:', dateValue);
    return 'Invalid Date';
  }
};

// Safe relative time formatting
export const safeFormatRelative = (dateValue: any): string => {
  if (!dateValue) return 'N/A';
  
  try {
    let date: Date;
    
    if (typeof dateValue === 'string') {
      date = parseISO(dateValue);
      if (!isValid(date)) {
        date = new Date(dateValue);
      }
    } else if (dateValue instanceof Date) {
      date = dateValue;
    } else {
      date = new Date(String(dateValue));
    }
    
    if (!isValid(date) || isNaN(date.getTime())) {
      return 'Invalid Date';
    }
    
    const now = new Date();
    const diffInMs = now.getTime() - date.getTime();
    const diffInHours = Math.floor(diffInMs / (1000 * 60 * 60));
    const diffInDays = Math.floor(diffInHours / 24);
    
    if (diffInDays > 0) {
      return `${diffInDays} day${diffInDays > 1 ? 's' : ''} ago`;
    } else if (diffInHours > 0) {
      return `${diffInHours} hour${diffInHours > 1 ? 's' : ''} ago`;
    } else {
      const diffInMinutes = Math.floor(diffInMs / (1000 * 60));
      if (diffInMinutes > 0) {
        return `${diffInMinutes} minute${diffInMinutes > 1 ? 's' : ''} ago`;
      } else {
        return 'Just now';
      }
    }
  } catch (error) {
    console.warn('Relative date formatting error:', error, 'for value:', dateValue);
    return 'Invalid Date';
  }
};