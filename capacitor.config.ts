import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.redview.app',
  appName: 'RedView',
  webDir: 'www',
  server: {
    androidScheme: 'https',
  },
};

export default config;
