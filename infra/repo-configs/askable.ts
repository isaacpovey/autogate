import { repoConfigSchema, type RepoConfig } from '@autogate/contracts';

const config: RepoConfig = {
  id: 'askable-services',
  ragInclude: [
    'src/**/*.ts',
    'src/**/*.tsx',
    'packages/**/*.ts',
    'services/**/*.ts',
    'libs/**/*.ts',
  ],
  sensitivePaths: [
    'src/**/auth/**',
    'src/**/payments/**',
    'src/**/billing/**',
    '**/*.env*',
    'infra/**',
    'migrations/**',
  ],
  requiredChecks: 'all',
  agents: ['semantic', 'blast-radius', 'risk', 'pattern', 'security', 'architecture'],
};

export const askableConfig: RepoConfig = repoConfigSchema.parse(config);
