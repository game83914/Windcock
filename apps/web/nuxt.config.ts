import { defineNuxtConfig } from 'nuxt/config';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);

export default defineNuxtConfig({
  buildDir: process.env.NUXT_BUILD_DIR || '.nuxt',
  compatibilityDate: '2025-07-10',
  devtools: { enabled: false },
  ssr: true,

  modules: ['@nuxtjs/tailwindcss', '@pinia/nuxt'],

  css: ['~/assets/css/main.css'],

  app: {
    head: {
      title: '輿論測風向｜看見真實民意',
      meta: [
        { name: 'description', content: '一人一門號、一人一票的即時公共議題民調平台。' },
        { name: 'theme-color', content: '#f4f1ea' },
      ],
    },
  },

  runtimeConfig: {
    public: {
      apiBase: process.env.NUXT_PUBLIC_API_BASE || 'http://localhost:3001/api/v1',
      wsBase: process.env.NUXT_PUBLIC_WS_BASE || 'http://localhost:3001',
      turnstileSiteKey: process.env.NUXT_PUBLIC_TURNSTILE_SITE_KEY || '',
    },
  },

  vite: {
    resolve: {
      alias: {
        '#app-manifest': require.resolve('mocked-exports/empty'),
      },
    },
    server: {
      proxy: {
        '/api': {
          target: process.env.API_PROXY_TARGET || 'http://localhost:3001',
          changeOrigin: true,
        },
      },
    },
  },
});
