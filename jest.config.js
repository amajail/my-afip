module.exports = {
  testEnvironment: 'node',
  setupFilesAfterEnv: ['<rootDir>/tests/helpers/test-setup.js'],
  testPathIgnorePatterns: ['/node_modules/', '/data/', '/certificates/'],
  collectCoverageFrom: [
    'src/**/*.js',
    '!src/cli.js',
    '!src/index.js'
  ],
  coverageDirectory: 'coverage',
  coverageReporters: ['text', 'lcov', 'html'],
  coverageThreshold: {
    global: {
      branches: 57,
      functions: 57,
      lines: 57,
      statements: 57
    }
  },
  testMatch: [
    '<rootDir>/tests/**/*.test.js'
  ],
  verbose: true,
  clearMocks: true,
  resetMocks: true,
  restoreMocks: true
};