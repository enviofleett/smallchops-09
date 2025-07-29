import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { componentTagger } from "lovable-tagger";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  server: {
    host: mode === "development" ? "::" : "localhost",
    port: 8080,
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
    sourcemap: mode !== "production",
    minify: false,
    rollupOptions: {
      output: {
        manualChunks: {
          vendor: ["react", "react-dom", "react-router-dom"],
          ui: [
            "@radix-ui/react-dialog",
            "@radix-ui/react-dropdown-menu",
            "@radix-ui/react-select",
            "@radix-ui/react-accordion",
            "@radix-ui/react-tabs",
            "@radix-ui/react-toast",
          ],
          query: ["@tanstack/react-query"],
          utils: ["clsx", "tailwind-merge", "date-fns", "zod"],
          charts: ["recharts"],
          huggingface: ["@huggingface/transformers"],
          maps: ["@maptiler/sdk", "maplibre-gl-draw"],
        },
      },
    },
    target: "esnext",
    chunkSizeWarningLimit: 1000,
  },
  define: {
    __DEV__: mode === "development",
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "@tanstack/react-query",
      "@supabase/supabase-js",
    ],
  },
}));
