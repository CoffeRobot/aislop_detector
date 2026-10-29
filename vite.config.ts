import { defineConfig } from 'vite'
import { crx } from '@crxjs/vite-plugin'
import manifest from './manifest.config'

// Extension pages beyond the manifest-declared ones: the paste-a-post harness
// and the offscreen document that hosts the model.
export default defineConfig({
  plugins: [crx({ manifest })],
  build: {
    rollupOptions: {
      input: {
        harness: 'src/harness.html',
        offscreen: 'src/offscreen.html',
      },
    },
  },
})