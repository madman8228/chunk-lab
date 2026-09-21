export default [
  {
    files: ['scripts/test-manifest.cjs', 'scripts/run-tests.cjs', 'scripts/lib-deps.js', 'scripts/lib-deps.test.js'],
    languageOptions: {
      ecmaVersion: 2022,
      sourceType: 'commonjs',
      globals: { console: 'readonly', process: 'readonly', __dirname: 'readonly', setTimeout: 'readonly', clearTimeout: 'readonly' },
    },
    rules: {
      'no-const-assign': 'error',
      'no-dupe-keys': 'error',
      'no-unreachable': 'error',
      'no-undef': 'error',
      'no-unused-vars': 'off',
      'eqeqeq': 'off',
      'semi': ['error', 'always'],
    },
  },
  { ignores: ['node_modules/**', 'output/**', 'js/vendor/**'] },
];
