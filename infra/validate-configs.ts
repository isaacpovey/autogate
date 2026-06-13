import { repoConfigSchema, type RepoConfig } from '@autogate/contracts';
import { askableConfig } from './repo-configs/askable.js';
import { autogateConfig } from './repo-configs/autogate.js';

type NamedConfig = { name: string; config: RepoConfig };

const targets: NamedConfig[] = [
  { name: 'askable', config: askableConfig },
  { name: 'autogate', config: autogateConfig },
];

const validate = ({ name, config }: NamedConfig): boolean => {
  const result = repoConfigSchema.safeParse(config);
  if (!result.success) {
    console.log(`FAIL: ${name} did not validate against RepoConfig: ${result.error.message}`);
    return false;
  }
  const { id, ragInclude, sensitivePaths, requiredChecks, agents } = result.data;
  console.log(
    `PASS: ${name} valid RepoConfig id=${id} ragInclude=${ragInclude.length} ` +
      `sensitivePaths=${sensitivePaths.length} requiredChecks=${JSON.stringify(requiredChecks)} ` +
      `agents=[${agents.join(',')}]`,
  );
  return true;
};

const allValid = targets.map(validate).every(Boolean);

if (allValid) {
  console.log(`\nPASS: all ${targets.length} repo-configs validate against the RepoConfig schema.`);
  process.exit(0);
}
console.log('\nFAIL: one or more repo-configs failed validation.');
process.exit(1);
