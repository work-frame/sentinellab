import next from 'eslint-config-next';

const config = [
  { ignores: ['.next/**', 'node_modules/**', 'next-env.d.ts'] },
  ...next,
  {
    rules: {
      'react/no-danger': 'error',
      'no-console': ['warn', { allow: ['warn', 'error'] }],
    },
  },
];

export default config;
