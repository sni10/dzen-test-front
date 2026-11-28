import { fileURLToPath } from 'node:url'
import { mergeConfig, defineConfig, configDefaults } from 'vitest/config'
import viteConfig from './vite.config.ts'

export default mergeConfig(
  viteConfig,
  defineConfig({
    test: {
      environment: 'jsdom',
      setupFiles: ['src/__tests__/setup.ts'],
      exclude: [...configDefaults.exclude, 'e2e/**'],
      root: fileURLToPath(new URL('./', import.meta.url)),
      // json-summary feeds the README coverage badge (CI, main only); reports/ is the CI artifact
      coverage: {
        reporter: ['text', 'text-summary', 'html', 'json-summary'],
        reportsDirectory: 'reports/coverage',
      },
    },
  }),
)
