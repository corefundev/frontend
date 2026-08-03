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
    // Хост-роутинг (вариант B): на app-хосте кабинет живёт от корня, поэтому
    // захардкоженный '/app/...' в ссылке не матчится ни одним маршрутом —
    // роутер мигает главной, затем HostZoneGuard делает полный reload.
    // Все внутренние ссылки кабинета обязаны ходить через cabPath()/appUrl().
    'no-restricted-syntax': ['error',
      {
        selector: 'JSXAttribute[name.name=/^(to|href|basePath)$/] > Literal[value=/^\\u002Fapp(\\u002F|$)/]',
        message: 'Hardcoded /app/… link breaks on the app host (Главная flash + full reload). Route it through cabPath()/appUrl() from shared/hostRouting.',
      },
      {
        selector: 'JSXAttribute[name.name=/^(to|href|basePath)$/] > JSXExpressionContainer > Literal[value=/^\\u002Fapp(\\u002F|$)/]',
        message: 'Hardcoded /app/… link breaks on the app host (Главная flash + full reload). Route it through cabPath()/appUrl() from shared/hostRouting.',
      },
      {
        selector: 'CallExpression[callee.name=/^(nav|navigate)$/] > Literal[value=/^\\u002Fapp(\\u002F|$)/]',
        message: 'Hardcoded /app/… navigation breaks on the app host. Route it through cabPath()/appUrl() from shared/hostRouting.',
      },
    ],
  },
}
