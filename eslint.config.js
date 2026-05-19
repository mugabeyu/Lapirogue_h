const { eslintrc } = require('@eslint/eslintrc');

/** @type {import('eslint').Linter.Config} */
const config = {
  extends: [
    'eslint:recommended',
    '@typescript-eslint/recommended',
    'plugin:react/recommended',
    'next/core-web-vitals',
    'next/typescript'
  ],
  plugins: ['@typescript-eslint', 'react'],
  rules: {
    '@typescript-eslint/no-explicit-any': 'error',
    'react/no-unescaped-entities': 'off',
    '@next/next/no-img-element': 'off'
  }
};

module.exports = config;