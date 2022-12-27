module.exports = {
  env: {
    browser: true,
    commonjs: true,
    es2021: true,
  },
  overrides: [],
  parserOptions: {
    ecmaVersion: 'latest',
  },
  ignorePatterns: ['public/*'],
  rules: {
    'quotes': ['error', 'single']
  },
};
