// Fallback business contact information for production
// This data was moved from the public business_settings table to protect sensitive information

export const BUSINESS_CONTACT_INFO = {
  email: 'store@startersmallchops.com',
  phone: '+234 123 456 7890',
  address: 'Lagos, Nigeria',
  // Add other contact details as needed
};

// For admin components that need to display contact info
export const getBusinessContactInfo = () => {
  return BUSINESS_CONTACT_INFO;
};