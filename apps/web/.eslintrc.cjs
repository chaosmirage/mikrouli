const reactRefreshOnlyExportComponents = ['warn', { allowConstantExport: true }];

const env = { browser: true, es2020: true };

const parserOptions = {
  ecmaVersion: 'latest',
  sourceType: 'module',
};

const rules = {
  'react-refresh/only-export-components': reactRefreshOnlyExportComponents,
  'react/jsx-no-bind': 'error',
  'react/no-unstable-nested-components': 'error',
  'react/jsx-no-constructed-context-values': 'error',
  'react/no-array-index-key': 'error',
};

const extendsList = [
  'eslint:recommended',
  'plugin:@typescript-eslint/recommended',
  'plugin:react-hooks/recommended',
  'plugin:react/recommended',
  'plugin:react/jsx-runtime',
];

module.exports = {
  root: true,
  env,
  extends: extendsList,
  ignorePatterns: ['dist', '.eslintrc.cjs'],
  parser: '@typescript-eslint/parser',
  parserOptions,
  plugins: ['react-refresh', 'react'],
  rules,
  settings: {
    react: {
      version: 'detect',
    },
  },
};
