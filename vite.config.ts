import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  // relative paths so the build works from a GitHub Pages subdirectory
  base: './',
  plugins: [react(), tailwindcss()],
});
