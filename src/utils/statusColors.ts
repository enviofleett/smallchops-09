
// Centralized status color utilities for consistent badge styling across the admin dashboard

export const getStatusColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'pending': 
      return 'bg-red-100 text-red-800 border-red-200';
    case 'confirmed': 
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'ready': 
      return 'bg-green-100 text-green-800 border-green-200';
    case 'out_for_delivery':
    case 'out-for-delivery':
      return 'bg-purple-100 text-purple-800 border-purple-200';
    case 'delivered': 
      return 'bg-gray-900 text-white border-gray-900';
    case 'cancelled': 
      return 'bg-red-100 text-red-800 border-red-200';
    case 'refunded': 
      return 'bg-orange-100 text-orange-800 border-orange-200';
    default: 
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

export const getStatusTextColor = (status: string): string => {
  switch (status?.toLowerCase()) {
    case 'pending': return 'text-red-800';
    case 'confirmed': return 'text-yellow-800';
    case 'ready': return 'text-green-800';
    case 'out_for_delivery':
    case 'out-for-delivery': return 'text-purple-800';
    case 'delivered': return 'text-gray-900';
    case 'cancelled': return 'text-red-800';
    case 'refunded': return 'text-orange-800';
    default: return 'text-gray-800';
  }
};
