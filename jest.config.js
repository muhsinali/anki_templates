module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  // Reset mock state between tests so it can't leak as the suite grows
  clearMocks: true,
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json'
    }]
  }
};
