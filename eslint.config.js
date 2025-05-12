import js from '@eslint/js';
import ts from '@typescript-eslint/eslint-plugin';
import parser from '@typescript-eslint/parser';

export default [
  js.configs.recommended,

  {
    files: ['**/*.ts', '**/*.tsx'],
    languageOptions: {
      parser,
      parserOptions: { project: './tsconfig.json', sourceType: 'module' },
    },
    plugins: { '@typescript-eslint': ts },

    // ⬇ Either turn them off or only warn while you scaffold
    rules: {
      '@typescript-eslint/no-unused-vars': 'warn',   // or 'off'
      'no-unused-vars': 'off',                       // handled by TS rule
      'no-undef': 'off',
      'no-console': 'off',
    },
  },
];
