import { repoConfigSchema, type RepoConfig } from '@autogate/contracts';

const config: RepoConfig = {
  id: 'autogate',
  ragInclude: [
    'apps/api/src/**/*.ts',
    'apps/web/app/**/*.{ts,tsx}',
    'apps/web/trpc/**/*.ts',
    'packages/api/src/**/*.ts',
    'packages/contracts/src/**/*.ts',
    'packages/sandbox/src/**/*.ts',
    'packages/store-postgres/src/**/*.ts',
    'packages/vcs-github/src/**/*.ts',
    'packages/memory-qdrant/src/**/*.ts',
    'infra/repo-configs/**/*.ts',
  ],
  sensitivePaths: [
    'packages/contracts/src/ports/**',
    'packages/vcs-github/src/**',
    'packages/store-postgres/src/migrations/**',
    'infra/**',
    '.github/workflows/**',
    '**/*.env*',
  ],
  requiredChecks: 'all',
  agents: ['semantic', 'blast-radius', 'risk', 'pattern', 'security', 'architecture'],
};

export const autogateConfig: RepoConfig = repoConfigSchema.parse(config);
