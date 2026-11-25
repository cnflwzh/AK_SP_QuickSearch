import js from '@eslint/js';
import {defineConfig} from 'eslint/config';
import vue from 'eslint-plugin-vue';
import globals from 'globals';
import tseslint from 'typescript-eslint';

export default defineConfig([
  {ignores: ['dist/**', 'node_modules/**', 'public/**', '.codex-*/**', '.playwright-mcp/**']},
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
    files: ['src/**/*.{ts,vue}', 'data/**/*.ts'],
    languageOptions: {
      parserOptions: {parser: tseslint.parser},
      globals: globals.browser,
    },
  },
  {
    files: ['**/*.{js,mjs,cjs}', 'scripts/**/*.{ts,mts,cts}', 'vite.config.ts'],
    languageOptions: {globals: globals.node},
  },
  {
    files: ['src/**/*.{ts,vue}'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              regex: '(?:^|/)data/seasons/',
              message: '请通过 data/index.ts 或比较页数据入口读取赛季数据。',
            },
          ],
        },
      ],
      'no-restricted-syntax': [
        'error',
        {
          selector: 'ImportExpression[source.value=/data\\x2fseasons\\x2f/]',
          message: '动态加载同样须通过公共赛季数据入口。',
        },
      ],
    },
  },
  {
    files: ['data/index.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          paths: [
            {
              name: './seasons/registry.ts',
              message:
                '完整赛季快照仅从 data/comparison 入口加载；公共入口只使用当前赛季和轻量目录。',
            },
          ],
        },
      ],
    },
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
]);
