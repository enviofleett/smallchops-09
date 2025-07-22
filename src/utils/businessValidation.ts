
export const isValidJson = (jsonString: string): boolean => {
  if (!jsonString.trim()) return true; // Empty string is valid
  
  try {
    JSON.parse(jsonString);
    return true;
  } catch {
    return false;
  }
};

export const parseSocialLinksValue = (socialLinks: string): any => {
  if (!socialLinks.trim()) {
    return null;
  }
  
  try {
    return JSON.parse(socialLinks);
  } catch {
    throw new Error("Invalid JSON format for social links");
  }
};

export const validateEmail = (email: string): boolean => {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  return emailRegex.test(email);
};

export const validatePhone = (phone: string): boolean => {
  if (!phone.trim()) return true; // Phone is optional
  const phoneRegex = /^[\+]?[1-9][\d\s\-\(\)\.]{7,15}$/;
  return phoneRegex.test(phone.replace(/\s/g, ''));
};

export const sanitizeInput = (input: string): string => {
  return input.trim().replace(/[<>]/g, '');
};

export const validateBusinessSettings = (business: any): string[] => {
  const errors: string[] = [];
  
  if (!business.name?.trim()) {
    errors.push("Business name is required");
  }
  
  if (business.email && !validateEmail(business.email)) {
    errors.push("Please enter a valid email address");
  }
  
  if (business.phone && !validatePhone(business.phone)) {
    errors.push("Please enter a valid phone number");
  }
  
  if (business.social_links && !isValidJson(business.social_links)) {
    errors.push("Social links must be valid JSON format");
  }
  
  return errors;
};
