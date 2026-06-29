import { defineConfig, loadEnv } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve } from 'path'

// https://vite.dev/config/
export default defineConfig(({ mode }) => {
  // Load env variables for the current mode
  const env = loadEnv(mode, process.cwd(), '')
  const isProd = mode === 'production'

  return {
    plugins: [
      react(),
      tailwindcss(),
    ],

    // Path aliases
    resolve: {
      alias: {
        '@': resolve(__dirname, 'src'),
        '@components': resolve(__dirname, 'src/components'),
        '@hooks': resolve(__dirname, 'src/hooks'),
        '@services': resolve(__dirname, 'src/services'),
        '@utils': resolve(__dirname, 'src/utils'),
        '@types': resolve(__dirname, 'src/types'),
        '@pages': resolve(__dirname, 'src/pages'),
        '@contracts': resolve(__dirname, 'src/contracts'),
        '@i18n': resolve(__dirname, 'src/i18n'),
      },
    },

    // Environment variable handling — only expose VITE_ prefixed vars to client
    envPrefix: 'VITE_',

    // Dev server
    server: {
      port: 5173,
      host: true,
      proxy: {
        '/api': {
          target: env.VITE_API_URL || 'http://localhost:3001',
          changeOrigin: true,
          secure: false,
        },
      },
    },

    // Preview server (mirrors dev server port for consistency)
    preview: {
      port: 4173,
      host: true,
    },

    build: {
      outDir: 'dist',
      // Source maps: full in dev, hidden (no public reference) in prod
      sourcemap: isProd ? 'hidden' : true,
      rollupOptions: {
        output: {
          // Chunk splitting for optimal caching
          manualChunks(id) {
            if (id.includes('node_modules')) {
              if (id.includes('react') || id.includes('react-dom') || id.includes('react-router-dom')) {
                return 'vendor-react';
              }
              if (id.includes('@stellar/stellar-sdk') || id.includes('@stellar/freighter-api') || id.includes('@stellar/stellar-base')) {
                return 'vendor-stellar';
              }
              if (id.includes('i18next') || id.includes('react-i18next') || id.includes('i18next-browser-languagedetector')) {
                return 'vendor-i18n';
              }
            }
          },
        },
      },
      // Warn when chunks exceed 500 kB
      chunkSizeWarningLimit: 500,
    },
  }
})
