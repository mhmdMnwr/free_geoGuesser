import { defineConfig } from "vite"
import react from "@vitejs/plugin-react"
import tailwindcss from "@tailwindcss/vite"
import path from "node:path"

import siteConfiguration from "./.figma/make/site.json" with { type: "json" }
import { figmaSiteConfiguration } from "./.figma/plugins/site-config.ts"
import {
  figmaErrorOverlayReplay,
  figmaReactRefreshBoundaryFallback,
  figmaMakeKitPlugin,
} from "./.figma/plugins/dev-plugins.ts"

const GATEWAY_PROXY = {
  "/api": {
    target: "http://localhost:5000",
    changeOrigin: true,
  },
  "/socket.io": {
    target: "http://localhost:5000",
    ws: true,
    changeOrigin: true,
  },
}

export default defineConfig(({ mode }) => {
  const emitSourcemaps = mode === "development"
  const host = process.env.FIGMA_DEV_SERVER_HOST || "0.0.0.0"
  const port = parseInt(process.env.PORT || "3000", 10)

  return {
    base: process.env.FIGMA_PUBLIC_URL ? `${process.env.FIGMA_PUBLIC_URL}/` : "/",
    build: {
      sourcemap: emitSourcemaps ? "inline" : false,
      minify: !emitSourcemaps,
    },
    plugins: [
      react(),
      tailwindcss(),
      figmaSiteConfiguration(siteConfiguration),
      figmaErrorOverlayReplay(),
      figmaReactRefreshBoundaryFallback(),
      figmaMakeKitPlugin({ storiesGlob: "/src/**/*.stories.{ts,tsx,js,jsx}" }),
    ],
    resolve: {
      alias: {
        "@": path.resolve(import.meta.dirname, "./src"),
      },
    },
    server: {
      host,
      port,
      strictPort: false,
      proxy: GATEWAY_PROXY,
      watch: {
        ignored: ["**/.figma/**"],
      },
    },
    preview: {
      host,
      port,
      proxy: GATEWAY_PROXY,
    },
  }
})
