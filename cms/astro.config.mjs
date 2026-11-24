import { defineConfig } from 'astro/config';
export default defineConfig({ output: 'static', compressHTML: false, outDir: './dist', build: { assets: 'admin-assets' } });
