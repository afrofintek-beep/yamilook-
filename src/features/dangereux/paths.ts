// Earlier Yamilook service workers already serve /app/ navigations from the network.
export const pilotPath = '/app/dangereux/';
export const pilotRoutes = ['/app/dangereux', '/app/dangereux/index.html', '/dangereux', '/dangereux/index.html'];

export function isPilotPath(pathname: string) {
  return pilotRoutes.includes(pathname.replace(/\/$/, '').toLowerCase());
}
