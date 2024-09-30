import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';
import fs from 'fs';
import path from 'path';

// https://vitejs.dev/config/
export default defineConfig({
  publicDir: 'public',
  base: "/",
  build: {
    sourcemap: true,
    assetsDir: "code",
    target: ["esnext"],
    cssMinify: true,
    lib: false
  },
  plugins: [
    VitePWA({
      strategies: "injectManifest",
      injectManifest: {
        swSrc: 'public/sw.js',
        swDest: 'dist/sw.js',
        globDirectory: 'dist',
        globPatterns: [
          '**/*.{html,js,css,json,png}',
        ],
      },
      injectRegister: false,
      manifest: false,
      devOptions: {
        enabled: true
      }
    })
  ],
  server: {
    https: {
      key: fs.readFileSync(path.resolve(process.env.HOME, 'dotfiles/private/certificates/live/localhost.m4k3.co/privkey.pem')),
      cert: fs.readFileSync(path.resolve(process.env.HOME, 'dotfiles/private/certificates/live/localhost.m4k3.co/fullchain.pem')),
    },
    host: 'localhost.m4k3.co',  // ドメイン名
    port: 5173,  // ポート番号
    open: true   // 自動でブラウザが開くオプション
  }
});