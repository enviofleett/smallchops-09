// Safe offline storage utilities
class OfflineStorage {
  private prefix = 'starters_app_';
  private maxItems = 100;

  // Safely store data with error handling
  setItem<T>(key: string, data: T): boolean {
    try {
      const serialized = JSON.stringify({
        data,
        timestamp: Date.now(),
        version: '1.0'
      });
      
      localStorage.setItem(this.prefix + key, serialized);
      this.cleanup();
      return true;
    } catch (error) {
      console.warn('Failed to store offline data:', error);
      return false;
    }
  }

  // Safely retrieve data with expiration check
  getItem<T>(key: string, maxAge: number = 24 * 60 * 60 * 1000): T | null {
    try {
      const item = localStorage.getItem(this.prefix + key);
      if (!item) return null;

      const parsed = JSON.parse(item);
      const now = Date.now();
      
      // Check if data is expired
      if (now - parsed.timestamp > maxAge) {
        this.removeItem(key);
        return null;
      }

      return parsed.data;
    } catch (error) {
      console.warn('Failed to retrieve offline data:', error);
      this.removeItem(key);
      return null;
    }
  }

  // Remove item
  removeItem(key: string): boolean {
    try {
      localStorage.removeItem(this.prefix + key);
      return true;
    } catch (error) {
      console.warn('Failed to remove offline data:', error);
      return false;
    }
  }

  // Clear old items to prevent storage bloat
  private cleanup() {
    try {
      const keys = Object.keys(localStorage)
        .filter(key => key.startsWith(this.prefix))
        .map(key => ({
          key,
          item: JSON.parse(localStorage.getItem(key) || '{}')
        }))
        .sort((a, b) => (a.item.timestamp || 0) - (b.item.timestamp || 0));

      // Remove oldest items if we exceed max
      if (keys.length > this.maxItems) {
        const toRemove = keys.slice(0, keys.length - this.maxItems);
        toRemove.forEach(({ key }) => {
          localStorage.removeItem(key);
        });
      }
    } catch (error) {
      console.warn('Failed to cleanup offline storage:', error);
    }
  }

  // Get storage usage info
  getStorageInfo() {
    const keys = Object.keys(localStorage).filter(key => key.startsWith(this.prefix));
    const totalSize = keys.reduce((size, key) => {
      const item = localStorage.getItem(key);
      return size + (item ? item.length : 0);
    }, 0);

    return {
      itemCount: keys.length,
      totalSize,
      maxItems: this.maxItems
    };
  }
}

export const offlineStorage = new OfflineStorage();