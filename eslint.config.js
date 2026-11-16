import js from '@eslint/js';
import {defineConfig} from 'eslint/config';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {ignores: ['dist/**', 'node_modules/**', 'public/**']},
  js.configs.recommended,
  tseslint.configs.recommended,
  vue.configs['flat/essential'],
  {
    rules: {
      'no-irregular-whitespace': [
        'error',
        {skipComments: true, skipTemplates: true},
      ],
      '@typescript-eslint/no-unused-vars': [
        'error',
        {
          argsIgnorePattern: '^_',
          varsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    files: ['**/*.vue'],
    rules: {
      // Template references are invisible to core JavaScript assignment analysis.
      'no-useless-assignment': 'off',
      // TypeScript checks names, including DOM types inside script setup.
      'no-undef': 'off',
      // Existing chapter components use single-word names; renaming is unrelated.
      'vue/multi-word-component-names': 'off',
      // 与 Prettier bracketSameLine 保持一致，结束尖括号跟随最后一个属性。
      'vue/html-closing-bracket-newline': [
        'error',
        {
          singleline: 'never',
          multiline: 'never',
          selfClosingTag: {singleline: 'never', multiline: 'never'},
        },
      ],
    },
  },
  {
    files: ['**/*.{ts,mts,cts,vue}'],
    languageOptions: {
      parserOptions: {parser: tseslint.parser},
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}', 'vite.config.ts'],
    languageOptions: {globals: globals.node},
  },
  {
    files: ['scripts/sw.template.js'],
    languageOptions: {
      globals: {
        ...globals.serviceworker,
        __CORE__: 'readonly',
        __IMAGES__: 'readonly',
      },
    },
  },
  {
    files: ['tests/**/*.mjs'],
    languageOptions: {globals: globals.browser},
  },
  {
    files: ['src/lib/runtime/analytics.ts'],
    // The Google tag queue intentionally stores Arguments, not an Array.
    rules: {'prefer-rest-params': 'off'},
  },
  {
    files: ['src/guide/chapters/recruitView.ts'],
    // These control characters delimit temporary markup placeholders.
    rules: {'no-control-regex': 'off'},
  },
]);
