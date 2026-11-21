import tsParser from '@typescript-eslint/parser';

const restricted = ['AudioContext', 'webkitAudioContext', 'OscillatorNode'].map((name) => ({
  name,
  message: 'Web Audio globals are only allowed under src/audio.',
}));

export default [
  { ignores: ['dist', 'node_modules', '.wrangler'] },
  {
    files: ['**/*.{ts,tsx}'],
    languageOptions: {
      parser: tsParser,
      parserOptions: { ecmaFeatures: { jsx: true } },
    },
    rules: { 'no-restricted-globals': ['error', ...restricted] },
  },
  {
    files: ['src/audio/**/*.{ts,tsx}'],
    rules: { 'no-restricted-globals': 'off' },
  },
];
