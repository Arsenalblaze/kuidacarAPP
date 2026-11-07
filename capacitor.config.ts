import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.kuidacar.app',
  appName: 'KuidaCar',
  webDir: 'dist',
  ios: {
    handleApplicationNotifications: false
  }
};

export default config;
