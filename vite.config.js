import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'
import legacy from '@vitejs/plugin-legacy'

export default defineConfig({
  plugins: [
    vue(),
    legacy({
      // Generates a legacy bundle + injects needed polyfills for targeted browsers.
      // Adjust targets if you need to support older environments.
      targets: ['defaults', 'not IE 11'],
      modernPolyfills: true
    })
  ],
  server: {
    port: 8080,
    proxy: {
      '/select': {
        target: 'http://localhost:9428',
        changeOrigin: true,
        ws: true // Enable WebSocket proxying
      }
    }
  },
  test: {
    globals: true,
    environment: 'happy-dom',
    setupFiles: ['./vitest.setup.js'],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'dist/',
        'examples/',
        '*.config.js',
        'test-tools.sh'
      ]
    }
  }
})
