// shortcut: full suite while it runs in ~1s; switch the task to a per-file
// `vitest related --run --passWithNoTests` once the suite grows past a few
// seconds (eval tooling, issue-9/10).
export default {
  '*.{js,cjs,mjs,ts,tsx}': ['eslint --fix', 'prettier --write'],
  '*.{json,html,css}': ['prettier --write'],
  // Function task: a plain string would get the staged filenames appended,
  // and vitest would read them as path filters matching no test file.
  '{src,tests}/**/*.{ts,tsx}': () => 'npm run test:staged',
}
