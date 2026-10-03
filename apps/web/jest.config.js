/** @type {import('jest').Config} */
module.exports = {
  testEnvironment: 'jsdom',
  roots: ['<rootDir>/test'],
  transform: { '^.+\\.tsx?$': ['ts-jest', { tsconfig: { jsx: 'react-jsx', module: 'commonjs', esModuleInterop: true } }] },
  moduleNameMapper: {
    '^@/(.*)$': '<rootDir>/$1',
    '^@sentinellab/types$': '<rootDir>/../../packages/types/src',
  },
  setupFilesAfterEnv: ['<rootDir>/test/setup.ts'],
};
