import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';

export default defineConfig({
  plugins: [react()],
  server: {
    host: '127.0.0.1',
  },
  build: {
    chunkSizeWarningLimit: 1300,
    rollupOptions: {
      output: {
        manualChunks: {
          three: ['three', '@react-three/fiber', '@react-three/drei'],
          spring: ['@react-spring/three'],
        },
      },
    },
  },
});
