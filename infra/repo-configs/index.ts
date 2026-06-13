import type { RepoConfig } from '@autogate/contracts';
import { askableConfig } from './askable.js';
import { autogateConfig } from './autogate.js';

export { askableConfig } from './askable.js';
export { autogateConfig } from './autogate.js';

/** All configured repos — the source of truth for the dashboard's `repos()` list. */
export const repoConfigs: RepoConfig[] = [autogateConfig, askableConfig];
