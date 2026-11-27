import type { CapacitorConfig } from '@capacitor/cli';

const config: CapacitorConfig = {
  appId: 'com.origin.reader',
  appName: 'Origin Reader',
  webDir: 'dist',
  backgroundColor: '#f5f3ec',
  android: { backgroundColor: '#f5f3ec', allowMixedContent: false, minWebViewVersion: 109 },
  plugins: { StatusBar: { style: 'LIGHT', backgroundColor: '#f5f3ec' } },
};
export default config;
