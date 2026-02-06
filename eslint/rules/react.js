/**
 * React-specific ESLint rules
 * For .tsx files using React components
 */
export const reactRules = {
  // React best practices
  'react/react-in-jsx-scope': 'off', // Not needed in React 19
  'react/prop-types': 'off', // We use TypeScript
  'react/jsx-uses-react': 'off', // Not needed in React 19
  'react/jsx-uses-vars': 'error',

  // Hooks
  'react-hooks/rules-of-hooks': 'error',
  'react-hooks/exhaustive-deps': 'warn',

  // JSX style
  'react/self-closing-comp': 'error',
  'react/jsx-boolean-value': ['error', 'never'],
  'react/jsx-curly-brace-presence': [
    'error',
    {
      props: 'never',
      children: 'never',
    },
  ],

  // Performance
  'react/jsx-no-bind': [
    'warn',
    {
      allowArrowFunctions: true,
      allowBind: false,
    },
  ],

  // Accessibility
  'react/jsx-no-target-blank': 'error',
};
