module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'jsdom',
  // Reset mock state between tests so it can't leak as the suite grows
  clearMocks: true,
  // V8 coverage (not Istanbul): the eval-based tests load src/ code via
  // window.eval with an inline source map + file:// sourceURL (see
  // tests/helpers.ts), which V8 attributes back to the real .ts files.
  // Istanbul instruments at the transform stage and cannot see eval'd code.
  coverageProvider: 'v8',
  // List files explicitly so never-loaded files show up as 0% instead of
  // being invisible. Declaration files are excluded: they contain no
  // executable code, but Node 24's V8 coverage counts them as 0% rows,
  // which would sink the src/ threshold. check-diagrams.ts is excluded
  // because it is a CI gate script that shells out to the external mmdr
  // binary — exercising it under Jest would make the suite depend on a
  // Rust toolchain every contributor would need.
  collectCoverageFrom: [
    'src/**/*.ts',
    '!src/**/*.d.ts',
    'scripts/**/*.ts',
    '!scripts/check-diagrams.ts',
  ],
  // Ratchet: slightly below observed values (src ~99.6/97.8, scripts
  // ~94/93/83 at the time of writing) so coverage can only stay level or
  // rise. Files matching the src path are excluded from the global check,
  // so "global" effectively guards scripts/.
  coverageThreshold: {
    global: { statements: 90, branches: 90, functions: 80, lines: 90 },
    './src/': { statements: 95, branches: 95, functions: 95, lines: 95 },
  },
  transform: {
    '^.+\\.tsx?$': ['ts-jest', {
      tsconfig: 'tsconfig.jest.json'
    }]
  }
};
