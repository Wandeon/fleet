import type { PageServerLoad } from './$types';

export const load: PageServerLoad = async () => {
  // Read environment configuration that is set via vps/fleet.env
  const envConfig = {
    apiBaseUrl: process.env.API_BASE_URL || 'Not configured',
    apiBearer: process.env.API_BEARER ? '••••••••' : 'Not configured',
    host: process.env.HOST || '0.0.0.0',
    port: process.env.PORT || '3000',
    origin: process.env.ORIGIN || 'Not configured',
  };

  return {
    envConfig,
  };
};
