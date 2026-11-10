import { defineConfig } from 'vite';
import react from '@vitejs/plugin-react-swc';
import path from 'node:path';
export default defineConfig({ plugins: [react()], optimizeDeps: { entries: ['tests/post-editor/harness.html'] }, resolve: { alias: [
 { find: '@/hooks/useAuth', replacement: path.resolve('tests/post-editor/auth.ts') },
 { find: '@', replacement: path.resolve('src') },
] } });
