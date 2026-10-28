import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins:[react()],
  publicDir:false,
  base:'./',
  define:{'process.env.NODE_ENV':JSON.stringify('production')},
  build:{
    outDir:'.portable-build',
    emptyOutDir:true,
    target:'es2020',
    sourcemap:false,
    cssCodeSplit:false,
    assetsInlineLimit:()=>true,
    lib:{entry:fileURLToPath(new URL('./src/main.tsx',import.meta.url)),name:'MemoryBoxPortable',formats:['iife'],fileName:()=> 'memorybox.js'},
    rollupOptions:{output:{inlineDynamicImports:true,assetFileNames:'[name][extname]'}},
    chunkSizeWarningLimit:3000
  }
});
