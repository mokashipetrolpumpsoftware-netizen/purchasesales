import type { CapacitorConfig } from '@capacitor/cli';

const serverUrl = process.env.CAPACITOR_SERVER_URL;

const config: CapacitorConfig = {
  appId: 'com.pharmaagro.app',
  appName: 'PharmaAgro',
  webDir: 'capacitor-www',
  ...(serverUrl ? { server: { url: serverUrl } } : {}),
};

export default config;
