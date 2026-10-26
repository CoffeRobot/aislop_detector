import { defineManifest } from '@crxjs/vite-plugin'

export default defineManifest({
  manifest_version: 3,
  name: 'AISlop Detector',
  version: '0.0.1',
  description: 'Scores X timeline posts locally with an in-browser decision model.',
  background: { service_worker: 'src/background.ts', type: 'module' },
  content_scripts: [
    { matches: ['https://x.com/*', 'https://twitter.com/*'], js: ['src/content.ts'] },
  ],
})