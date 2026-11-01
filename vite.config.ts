import { paposApplication } from "./build/papos-plugin";
import { defineConfig } from "vite";
import react from "@vitejs/plugin-react-swc";
import path from "path";
import { VitePWA } from "vite-plugin-pwa";

// https://vitejs.dev/config/
export default defineConfig(({ mode }) => ({
  base: "/",
  define: {
    'import.meta.env.APP_BUILD_ID': JSON.stringify(/^[a-f0-9]{40}$/i.test(process.env.VERCEL_GIT_COMMIT_SHA || '') ? process.env.VERCEL_GIT_COMMIT_SHA!.slice(0, 12) : 'development'),
  },
  server: {
    host: "::",
    port: 8080,
  },
  build: {
    sourcemap: mode === "development",
    minify: "esbuild",
    rollupOptions: {
      input: { yamilook: path.resolve(__dirname, "index.html"), papos: path.resolve(__dirname, "papos-app/index.html") },
      output: {
        manualChunks: {
          "vendor-react": ["react", "react-dom", "react-router-dom"],
          "vendor-ui": ["framer-motion", "@radix-ui/react-dialog", "@radix-ui/react-popover"],
          "vendor-data": ["@tanstack/react-query", "@supabase/supabase-js"],
        },
      },
    },
  },
  plugins: [
    react(),
    VitePWA({
      registerType: "autoUpdate",
      injectRegister: null,
      includeAssets: ["favicon.ico", "yamilook-logo.png"],
      workbox: {
        globIgnores: ["papos-app/**"],
        globPatterns: ["**/*.{js,css,html,ico,png,svg,woff2}"],
        navigateFallbackDenylist: [/^\/papos-app(?:\/|$)/,/^\/~oauth/, /^\/guia/, /^\/app/, /^\/download/, /^\/store/],
        cleanupOutdatedCaches: true,
        clientsClaim: true,
        skipWaiting: true,
        runtimeCaching: [
          {
            // Only public post media; authenticated API and signed URLs are excluded.
            urlPattern: ({ url, request }) => request.destination === "image"
              && url.origin === "https://rfayqekonkovfbkwjjum.supabase.co"
              && (
                url.pathname.startsWith("/storage/v1/object/public/media/")
                || url.pathname.startsWith("/storage/v1/render/image/public/media/")
                || url.pathname.startsWith("/storage/v1/render/image/public/avatars/")
              ),
            handler: "CacheFirst",
            options: {
              cacheName: "yamilook-post-images-v1",
              cacheableResponse: { statuses: [200] },
              expiration: { maxEntries: 100, maxAgeSeconds: 60 * 60 * 24 * 7, purgeOnQuotaError: true },
            },
          },

        ],
      },
      manifest: {
        id: "/",
        name: "Yamilook",
        short_name: "Yamilook",
        description: "A vida como ela é. Conecte-se com pessoas reais em tempo real.",
        theme_color: "#111111",
        background_color: "#111111",
        display: "standalone",
        orientation: "portrait",
        scope: "/",
        start_url: "/muxi",
        icons: [
          { src: "/pwa-192x192.png", sizes: "192x192", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png" },
          { src: "/pwa-512x512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
        ],
      },
    }),
    paposApplication(),
  ],
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
      react: path.resolve(__dirname, "node_modules/react"),
      "react-dom": path.resolve(__dirname, "node_modules/react-dom"),
      "react/jsx-runtime": path.resolve(__dirname, "node_modules/react/jsx-runtime"),
      "react/jsx-dev-runtime": path.resolve(__dirname, "node_modules/react/jsx-dev-runtime"),
      "@tanstack/react-query": path.resolve(__dirname, "node_modules/@tanstack/react-query"),
    },
    dedupe: ["react", "react-dom", "@tanstack/react-query"],
  },
  optimizeDeps: {
    include: [
      "react",
      "react-dom",
      "react/jsx-runtime",
      "react/jsx-dev-runtime",
      "@tanstack/react-query",
      "@supabase/supabase-js",
      "framer-motion",
    ],
    esbuildOptions: {
      target: "es2020",
    },
  },
}));
