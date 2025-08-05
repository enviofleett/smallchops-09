import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// Enhanced config with WebSocket handling
export default defineConfig(({ mode }) => ({
  server: {
    host: mode === "development" ? "::" : "localhost",
    port: 8080,
    hmr: mode === "development" ? {
      port: 8081,
      overlay: false
    } : false,
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
    minify: false,
    rollupOptions: {
      output: {
        manualChunks: undefined, // Disable chunking temporarily
      },
    },
  },
  define: {
    __DEV__: mode === "development",
  },
}));