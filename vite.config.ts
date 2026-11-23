import { defineConfig } from 'vite';

export default defineConfig({
  // caminhos relativos: funciona tanto em localhost quanto em https://<usuario>.github.io/fizzi-mine/
  base: './',
  server: { open: true },
});
