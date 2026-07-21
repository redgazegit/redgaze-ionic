import type { CapacitorConfig } from '@capacitor/cli';

const PROXY_HOST = process.env.CAP_PROXY_HOST || '';
const PROXY_PORT = process.env.CAP_PROXY_PORT || '8080';

const server: CapacitorConfig['server'] = PROXY_HOST
  ? {
      url: `http://${PROXY_HOST}:${PROXY_PORT}`,
      cleartext: true,
    }
  : {
      androidScheme: 'http',
    };

const config: CapacitorConfig = {
  appId: 'com.redgaze.app',
  appName: 'red-gaze',
  webDir: 'www/browser',
  server,
};

export default config;
