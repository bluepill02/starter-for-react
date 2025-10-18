export default {
  preset: 'ts-jest/presets/default-esm',
  extensionsToTreatAsEsm: ['.ts', '.tsx'],
  testEnvironment: 'jsdom',
  testEnvironmentOptions: {
    customExportConditions: ['node', 'node-addons'],
  },
  roots: ['<rootDir>/packages/tests'],
  testMatch: ['**/__tests__/**/*.ts', '**/__tests__/**/*.tsx', '**/?(*.)+(spec|test).ts', '**/?(*.)+(spec|test).tsx', '**/?(*.)+(spec|test).js'],
  transform: {
    '^.+\\.(ts|tsx)$': ['ts-jest', {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx',
        module: 'ESNext',
        moduleResolution: 'node',
        target: 'ES2020',
        strict: false,
        noImplicitAny: false
      },
    }],
  },
  transformIgnorePatterns: [
    'node_modules/(?!(.*\\.mjs$))'
  ],
  moduleFileExtensions: ['ts', 'tsx', 'js', 'jsx', 'json'],
  collectCoverageFrom: [
    'packages/schema/**/*.ts',
    'apps/web/src/**/*.ts',
    'apps/web/src/**/*.tsx',
    '!**/*.d.ts',
  ],
  setupFilesAfterEnv: ['<rootDir>/packages/tests/jest.setup.ts'],
  globals: {
    'ts-jest': {
      useESM: true,
      tsconfig: {
        jsx: 'react-jsx',
        module: 'ESNext',
        strict: false,
        noImplicitAny: false
      },
    },
  },
  moduleNameMapper: {
    '^@recognition/schema/(.*)$': '<rootDir>/packages/schema/src/$1',
    '^@/lib/(.*)$': '<rootDir>/apps/web/src/lib/$1',
    '^@/appwrite/(.*)$': '<rootDir>/apps/web/src/appwrite/$1',
    '^@/components/(.*)$': '<rootDir>/apps/web/src/components/$1',
    '^(\\.{1,2}/.*)\\.js$': '$1'
  }
};