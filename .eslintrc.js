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
    'quotes': ['error', 'single'],
    'space-before-blocks': ['error', 'always'],
    'space-before-function-paren': ['error', 'always'],
    'keyword-spacing': ['error', { 'before': true, 'after': true }],
    'no-var': 'error'
  },
};
