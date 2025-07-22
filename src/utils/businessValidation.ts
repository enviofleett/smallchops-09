
export const isValidJson = (str: string): boolean => {
  if (!str.trim()) return true;
  try {
    const val = JSON.parse(str);
    return typeof val === "object";
  } catch {
    return false;
  }
};

export const parseSocialLinksValue = (social_links: string): any => {
  if (!social_links?.trim()) return null;
  
  try {
    return JSON.parse(social_links);
  } catch {
    return null;
  }
};
