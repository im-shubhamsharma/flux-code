import { defineConfig } from 'tsup';

export default defineConfig({
  entry: { index: 'src/index.ts' },
  format: ['esm'],
  target: 'node18',
  platform: 'node',
  clean: true,
  dts: false,
  sourcemap: true,
  minify: false,
  // Prepend the shebang so the built file is directly executable.
  banner: { js: '#!/usr/bin/env node' },
});
