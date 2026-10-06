import { dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { FlatCompat } from '@eslint/eslintrc';

const compat = new FlatCompat({
  baseDirectory: dirname(fileURLToPath(import.meta.url)),
});

export default [
  ...compat.extends('next/core-web-vitals', 'next/typescript'),
  {
    ignores: [
      '.next/**',
      'node_modules/**',
      '**/.source/**',
      'next-env.d.ts',
      // Change-verification snapshots (original/modified copies of src files).
      // They are evidence, not source, and their copies do not resolve
      // neighbours such as ./social-providers.
      'artifacts/**',
    ],
  },
  {
    rules: {
      '@next/next/no-assign-module-variable': 'off',
      '@next/next/no-html-link-for-pages': 'off',
      '@typescript-eslint/ban-ts-comment': 'off',
      '@typescript-eslint/no-empty-object-type': 'off',
      '@typescript-eslint/no-explicit-any': 'off',
      '@typescript-eslint/no-require-imports': 'off',
      'import/no-anonymous-default-export': 'off',
      'prefer-const': 'off',
      'react/display-name': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
  {
    rules: {
      '@typescript-eslint/ban-ts-comment': 'off',
      'react-hooks/rules-of-hooks': 'off',
    },
  },
];
