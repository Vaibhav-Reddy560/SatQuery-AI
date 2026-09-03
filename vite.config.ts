import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import path from 'path'

export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: { '@': path.resolve(import.meta.dirname, './src') },
  },
  build: {
    chunkSizeWarningLimit: 900,
    rollupOptions: {
      output: {
        // Keep the heavy, route-specific libraries out of the entry chunk.
        // three/R3F only loads on the landing page; maplibre only on Explore.
        // Rolldown (Vite 8) takes manualChunks as a function, not an object.
        manualChunks(id: string) {
          if (!id.includes('node_modules')) return
          if (id.includes('three') || id.includes('@react-three')) return 'three'
          if (id.includes('maplibre')) return 'maplibre'
          if (id.includes('recharts') || id.includes('d3-')) return 'charts'
          if (id.includes('react-dom') || id.includes('react-router')) return 'react'
        },
      },
    },
  },
})
