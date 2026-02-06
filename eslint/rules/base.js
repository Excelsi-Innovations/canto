/**
 * Base ESLint rules for all files
 * General JavaScript/TypeScript code quality rules
 */
export const baseRules = {
  // Possible errors
  'no-console': 'off',
  'no-debugger': 'warn',
  'no-unused-vars': 'off', // Handled by TypeScript

  // Best practices
  'prefer-const': 'error',
  'no-var': 'error',
  'object-shorthand': 'error',
  'prefer-template': 'error',
  'prefer-arrow-callback': 'error',

  // Code style (minimal, let Prettier handle most)
  'no-multiple-empty-lines': ['error', { max: 1, maxEOF: 0 }],
  'no-trailing-spaces': 'error',
  'eol-last': ['error', 'always'],

  // Modern JS features
  'prefer-destructuring': [
    'error',
    {
      array: false,
      object: true,
    },
  ],
  'prefer-rest-params': 'error',
  'prefer-spread': 'error',
};
