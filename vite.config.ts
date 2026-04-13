import { defineConfig } from "vite-plus";
import react from "@vitejs/plugin-react";
import { VitePWA } from "vite-plugin-pwa";
import fs from "fs";
import path from "path";

const certDir = path.resolve(
  process.env.HOME!,
  "dotfiles/private/certificates/live/localhost.m4k3.co",
);
const httpsConfig = fs.existsSync(path.join(certDir, "privkey.pem"))
  ? {
      key: fs.readFileSync(path.join(certDir, "privkey.pem")),
      cert: fs.readFileSync(path.join(certDir, "fullchain.pem")),
    }
  : undefined;

// https://vitejs.dev/config/
export default defineConfig({
  staged: {
    "*": "vp check --fix",
  },
  lint: {
    ignorePatterns: ["server/**"],
    options: { typeAware: true, typeCheck: true },
  },
  publicDir: "public",
  base: "/",
  build: {
    sourcemap: true,
    assetsDir: "code",
    target: ["esnext"],
    cssMinify: true,
    lib: false,
  },
  plugins: [
    react(),
    VitePWA({
      strategies: "injectManifest",
      injectManifest: {
        swSrc: "public/sw.js",
        swDest: "dist/sw.js",
        globDirectory: "dist",
        globPatterns: ["**/*.{html,js,css,json,png}"],
      },
      injectRegister: false,
      manifest: false,
      devOptions: {
        enabled: true,
      },
    }),
  ],
  server: {
    https: httpsConfig,
    host: "localhost.m4k3.co",
    port: 5173,
    open: true,
  },
});
