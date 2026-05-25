import { FlatCompat } from '@eslint/eslintrc';
import js from '@eslint/js';
import type { Linter } from 'eslint';
import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const configDirectory = dirname(fileURLToPath(import.meta.url));
const compat = new FlatCompat({
  baseDirectory: configDirectory,
  recommendedConfig: js.configs.recommended,
  allConfig: js.configs.all,
});

const config: Linter.Config[] = [
  {
    ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'dist/**'],
  },
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    rules: {
      '@typescript-eslint/no-explicit-any': 'error',
      'react/no-unescaped-entities': 'off',
      '@next/next/no-img-element': 'off',
    },
  },
];

export default config;
