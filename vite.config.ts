import react from "@vitejs/plugin-react";
import { defineConfig, type Plugin, type ViteDevServer } from "vite";

/**
 * While testing with `npm run dev`, tells the page this computer's address on the local network (the "Network:" line
 * Vite prints), so the join QR code can point phones there instead of "localhost", which a phone can't open.
 */
function lanOrigin(): Plugin {
  let server: ViteDevServer | undefined;
  return {
    name: "shift-happens-lan-origin",
    apply: "serve",
    configureServer(dev) {
      server = dev;
    },
    transformIndexHtml() {
      const urls = server?.resolvedUrls?.network ?? [];
      // Prefer the usual home and office ranges over VPN or virtual adapters
      const url = urls.find(entry => /\/\/(192\.168\.|10\.|172\.(1[6-9]|2\d|3[01])\.)/.test(entry)) ?? urls[0];
      return url ? [{ tag: "meta", attrs: { name: "dev-lan-origin", content: new URL(url).origin }, injectTo: "head" }] : [];
    },
  };
}

export default defineConfig({
  // Relative paths so the build works from the GitHub Pages subfolder
  base: "./",
  plugins: [react(), lanOrigin()],
  // In development, listen on the network too, so phones that scan the join QR code can load the game
  server: { host: true },
  // Three.js is most of the bundle; one ~850 kB file (about 235 kB gzipped) is fine for a game
  build: { chunkSizeWarningLimit: 1000 },
});
