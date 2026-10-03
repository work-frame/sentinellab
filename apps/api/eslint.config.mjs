import base from '@sentinellab/config/eslint';

export default [
  ...base,
  {
    // Nest DTOs and modules use empty classes and decorators heavily.
    rules: { '@typescript-eslint/no-extraneous-class': 'off' },
  },
];
