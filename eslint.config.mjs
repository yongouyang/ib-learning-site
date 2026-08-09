import { defineConfig, globalIgnores } from 'eslint/config';
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import nextTypescript from 'eslint-config-next/typescript';
import reactHooks from 'eslint-plugin-react-hooks';

export default defineConfig([
  // Generated/build output and vendored data — never lint.
  globalIgnores([
    '.next/',
    'out/',
    'coverage/',
    'playwright-report/',
    'test-results/',
    'illustration-previews/',
    'lambda/feedback/dist/',
    'public/',
    'tools/data/',
  ]),
  {
    extends: [...nextCoreWebVitals, ...nextTypescript],
    plugins: { 'react-hooks': reactHooks },
    // eslint-config-next 16 ships react-hooks v6 with React-Compiler-powered
    // rules. The flagged patterns (setState-in-effect for external-store sync,
    // refs in render for one-shot init, Math.random in render) predate the
    // upgrade and work correctly — keep them visible as warnings and adopt
    // the new patterns incrementally rather than rewrite logic mid-upgrade.
    rules: {
      'react-hooks/set-state-in-effect': 'warn',
      'react-hooks/purity': 'warn',
      'react-hooks/refs': 'warn',
      'react-hooks/globals': 'warn',
      // Allow the idiomatic "omit a key via rest" pattern (`const { a: _omitted,
      // ...rest } = obj`) and intentionally-unused `^_` names.
      'no-unused-vars': 'off',
      '@typescript-eslint/no-unused-vars': [
        'warn',
        {
          ignoreRestSiblings: true,
          varsIgnorePattern: '^_',
          argsIgnorePattern: '^_',
          destructuredArrayIgnorePattern: '^_',
          caughtErrorsIgnorePattern: '^_',
        },
      ],
    },
  },
  {
    // Node scripts and config files: CommonJS require() is legitimate here.
    // (next lint never covered these paths; eslint 9 flat config lints
    // everything by default.)
    files: ['scripts/**', 'tools/scripts/**', '*.config.*'],
    rules: {
      '@typescript-eslint/no-require-imports': 'off',
    },
  },
  {
    files: ['tests/**'],
    rules: {
      '@typescript-eslint/no-explicit-any': 'off',
    },
  },
]);
