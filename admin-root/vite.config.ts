import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: 'public',   // default is 'public' but set it explicitly to be sure
  build: { outDir: 'dist' } // default is 'dist'; match your Pages "Build output directory"
})
