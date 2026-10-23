import { createContext, useContext } from 'react';
export type AppSurface = 'yamilook' | 'papos';
export const AppSurfaceContext = createContext<AppSurface>('yamilook');
export const useAppSurface = () => useContext(AppSurfaceContext);
export const PAPOS_BASE = '/papos-app';
