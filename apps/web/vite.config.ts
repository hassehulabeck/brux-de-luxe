import { defineConfig } from 'vite';
import vue from '@vitejs/plugin-vue';

export default defineConfig({
  plugins: [vue()],
  // Relative asset paths, so the build works in any folder on the web hotel.
  base: './',
});
