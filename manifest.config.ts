import { defineManifest } from '@crxjs/vite-plugin'

// COOP/COEP: opts the extension origin into cross-origin isolation so wllama's
// multi-threaded wasm (SharedArrayBuffer) can run in the offscreen document.
// Chrome supports these manifest keys since 93; @types/chrome 0.0.280 predates them.
const crossOriginIsolation = {
  cross_origin_opener_policy: { value: 'same-origin' },
  cross_origin_embedder_policy: { value: 'require-corp' },
}

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
  permissions: ['offscreen'],
  // wllama compiles its llama.cpp wasm inside the offscreen document — MV3
  // extension pages need 'wasm-unsafe-eval' (WebAssembly only, no eval).
  content_security_policy: {
    extension_pages: "script-src 'self' 'wasm-unsafe-eval'; object-src 'self'",
  },
  ...crossOriginIsolation,
})