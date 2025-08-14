export class AssetLoader {
  private static loadedScripts = new Set<string>();
  private static failedScripts = new Set<string>();

  static async loadScript(src: string, retries = 3): Promise<void> {
    if (this.loadedScripts.has(src)) return;
    if (this.failedScripts.has(src)) throw new Error(`Script ${src} previously failed`);

    for (let attempt = 0; attempt < retries; attempt++) {
      try {
        await this.attemptScriptLoad(src);
        this.loadedScripts.add(src);
        return;
      } catch (error) {
        console.warn(`Script load attempt ${attempt + 1} failed for ${src}:`, error);
        if (attempt === retries - 1) {
          this.failedScripts.add(src);
          throw error;
        }
        // Wait before retry
        await new Promise(resolve => setTimeout(resolve, 1000 * (attempt + 1)));
      }
    }
  }

  private static attemptScriptLoad(src: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const script = document.createElement('script');
      script.src = src;
      script.async = true;
      
      script.onload = () => resolve();
      script.onerror = () => reject(new Error(`Failed to load script: ${src}`));
      
      document.head.appendChild(script);
    });
  }

  static preloadCriticalAssets() {
    if (typeof window === 'undefined') return;

    // Preload critical vendor chunks
    const criticalAssets = [
      '/assets/vendor-react.js',
      '/assets/vendor-router.js',
      '/assets/app.css'
    ];

    criticalAssets.forEach(asset => {
      const link = document.createElement('link');
      link.rel = 'preload';
      link.as = asset.endsWith('.js') ? 'script' : 'style';
      link.href = asset;
      document.head.appendChild(link);
    });
  }
}