import { defineConfig } from 'astro/config';
import tailwindcss from '@tailwindcss/vite';

export default defineConfig({
  site: 'https://amajail.github.io',
  base: '/my-afip',
  output: 'static',
  vite: {
    plugins: [tailwindcss()],
  },
});
