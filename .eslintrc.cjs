// #379: this file was missing since the repo's creation — `npm run lint`
// failed on "couldn't find a configuration file" before analysing anything,
// so the CI lint gate was decorative. Standard Vite react-ts baseline; the
// deps were already pinned in devDependencies.
module.exports = {
  root: true,
  env: { browser: true, es2020: true },
  extends: [
    'eslint:recommended',
    'plugin:@typescript-eslint/recommended',
    'plugin:react-hooks/recommended',
  ],
  ignorePatterns: ['dist', 'node_modules', '*.cjs', 'vite.config.ts'],
  parser: '@typescript-eslint/parser',
  plugins: ['react-refresh'],
  rules: {
    'react-refresh/only-export-components': ['warn', { allowConstantExport: true }],
  },
}
