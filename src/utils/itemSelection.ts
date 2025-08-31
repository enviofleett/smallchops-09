/**
 * Utility function to select the best items to display based on product data completeness
 * 
 * Prefers detailedItems only if ALL items contain product and product.features/image_url;
 * otherwise, falls back to enrichedItems, and finally to fallbackItems.
 */
export const selectItemsToDisplay = (
  detailedItems?: any[],
  enrichedItems?: any[],
  fallbackItems?: any[]
) => {
  // Helper function to check if an item has complete product data
  const hasCompleteProductData = (item: any) => {
    if (!item?.product) return false;
    
    // Check for features (can be array, string, or object)
    const hasFeatures = Boolean(
      item.product.features && 
      (
        (Array.isArray(item.product.features) && item.product.features.length > 0) ||
        (typeof item.product.features === 'string' && item.product.features.trim().length > 0) ||
        (typeof item.product.features === 'object' && Object.keys(item.product.features).length > 0)
      )
    );
    
    // Check for image_url
    const hasImageUrl = Boolean(item.product.image_url && item.product.image_url.trim().length > 0);
    
    return hasFeatures || hasImageUrl; // At least one should be present
  };

  // Check if detailed items are available and ALL have complete product data
  if (detailedItems && detailedItems.length > 0) {
    const allHaveCompleteData = detailedItems.every(hasCompleteProductData);
    if (allHaveCompleteData) {
      return detailedItems;
    }
  }

  // Fallback to enriched items if available
  if (enrichedItems && enrichedItems.length > 0) {
    return enrichedItems;
  }

  // Final fallback to original order items
  return fallbackItems || [];
};