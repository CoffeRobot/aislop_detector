import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'AISlop Detector',
  version: '0.0.1',
  description: 'Scores X timeline posts locally with an in-browser decision model.',
  icons: {
    16: 'assets/icons/icon-16.png',
    32: 'assets/icons/icon-32.png',
    48: 'assets/icons/icon-48.png',
    128: 'assets/icons/icon-128.png',
  },
  background: { service_worker: 'src/background.ts', type: 'module' },
  content_scripts: [
    { matches: ['https://x.com/*', 'https://twitter.com/*'], js: ['src/content.ts'] },
  ],
})