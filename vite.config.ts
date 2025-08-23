import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: "::",
    port: 8080,
    hmr: {
      overlay: false,
    },
  },
  plugins: [
    react(),
    ...(mode === 'development' ? [componentTagger()] : []),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
  build: {
    outDir: "dist",
    minify: mode === 'production' ? 'esbuild' : false,
    sourcemap: mode === 'development' ? true : 'hidden',
    // Enable production optimizations
    cssCodeSplit: true,
    target: 'es2022',
    rollupOptions: {
      output: {
        manualChunks: {
          // Vendor chunk for stable libraries
          vendor: ['react', 'react-dom', 'react-router-dom'],
          // UI chunk for component libraries
          ui: [
            '@radix-ui/react-dialog', 
            '@radix-ui/react-select', 
            '@radix-ui/react-dropdown-menu',
            '@radix-ui/react-toast',
            '@radix-ui/react-popover'
          ],
          // Utils chunk for utilities
          utils: ['@tanstack/react-query', 'zod', 'date-fns', 'clsx', 'tailwind-merge'],
          // Supabase chunk
          supabase: ['@supabase/supabase-js'],
          // Charts and heavy libraries
          charts: ['recharts'],
          // Form handling
          forms: ['react-hook-form', '@hookform/resolvers'],
        },
        // Optimize chunk naming with better cache busting
        chunkFileNames: (chunkInfo) => {
          return `assets/${chunkInfo.name}-[hash].js`;
        },
        entryFileNames: 'assets/[name]-[hash].js',
        assetFileNames: (assetInfo) => {
          const info = assetInfo.name!.split('.');
          const ext = info[info.length - 1];
          if (/png|jpe?g|svg|gif|tiff|bmp|ico/i.test(ext)) {
            return `assets/images/[name]-[hash].[ext]`;
          }
          if (/css/i.test(ext)) {
            return `assets/styles/[name]-[hash].[ext]`;
          }
          return `assets/[name]-[hash].[ext]`;
        }
      },
    },
    // Increase chunk size warning limit for production builds
    chunkSizeWarningLimit: 1000,
    // Enable compression reporting
    reportCompressedSize: mode === 'production',
  },
  // Optimize dependencies
  optimizeDeps: {
    include: [
      'react', 
      'react-dom', 
      'react-router-dom', 
      '@tanstack/react-query',
      '@supabase/supabase-js',
      '@supabase/postgrest-js',
      '@supabase/storage-js',
      '@supabase/realtime-js'
    ],
    esbuildOptions: {
      target: 'esnext'
    }
  },
  ssr: {
    noExternal: ['@supabase/supabase-js']
  },
  define: {
    __DEV__: mode === "development",
  },
}));