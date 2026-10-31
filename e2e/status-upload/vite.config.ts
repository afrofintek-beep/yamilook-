import {defineConfig} from 'vite';import react from '@vitejs/plugin-react-swc';import path from 'node:path';
export default defineConfig({plugins:[react()],optimizeDeps:{entries:['e2e/status-upload/index.html']},resolve:{alias:[
 {find:'@/hooks/useAuth',replacement:path.resolve('e2e/scheduled/auth.ts')},
 {find:'@/hooks/useStatus',replacement:path.resolve('e2e/status-upload/status.ts')},
 {find:'@',replacement:path.resolve('src')},
]},server:{host:'127.0.0.1',port:8094}});
