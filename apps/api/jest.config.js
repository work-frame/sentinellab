const shared = {
  testEnvironment: 'node',
  transform: { '^.+\\.ts$': ['ts-jest', { tsconfig: 'tsconfig.json' }] },
  moduleNameMapper: {
    '^@sentinellab/types$': '<rootDir>/../../packages/types/src',
    '^@sentinellab/security-engine$': '<rootDir>/../../packages/security-engine/src',
  },
};

/** @type {import('jest').Config} */
module.exports = {
  projects: [
    { ...shared, displayName: 'unit', roots: ['<rootDir>/src'], testMatch: ['**/*.spec.ts'] },
    {
      ...shared,
      displayName: 'integration',
      roots: ['<rootDir>/test'],
      testMatch: ['**/*.e2e-spec.ts'],
      setupFiles: ['<rootDir>/test/setup-env.ts'],
      globalSetup: '<rootDir>/test/global-setup.ts',
      testTimeout: 30000,
    },
  ],
};
