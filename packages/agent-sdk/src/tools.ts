import type {
  MemoryRecord,
  RepoFileEntry,
  RepoGrepMatch,
  RunContext,
} from '@autogate/contracts';

/**
 * The closed universe of tools a Layer-2 agent may declare. The real Claude
 * Agent SDK adapter exposes only the allowlisted subset of these to the model;
 * the canned mock ignores tools entirely. Either way the allowlist is the
 * contract — an agent declaring a tool outside this set fails to assemble.
 */
export const ALL_TOOLS = [
  'read',
  'grep',
  'list',
  'memory.code_knowledge',
  'memory.decisions',
  'memory.patterns',
] as const;

export type ToolName = (typeof ALL_TOOLS)[number];

const isToolName = (name: string): name is ToolName =>
  (ALL_TOOLS as readonly string[]).includes(name);

/** Throw if any declared tool is outside {@link ALL_TOOLS}. */
export const assertKnownTools = ({ tools }: { tools: readonly string[] }): void => {
  const unknown = tools.filter((tool) => !isToolName(tool));
  if (unknown.length > 0) {
    throw new Error(
      `Unknown tool(s) in allowlist: ${unknown.join(', ')}. Known tools: ${ALL_TOOLS.join(', ')}`,
    );
  }
};

export type Toolset = {
  read: (args: { path: string }) => Promise<string>;
  grep: (args: { pattern: string; include?: string[] }) => Promise<RepoGrepMatch[]>;
  list: (args: { dir: string }) => Promise<RepoFileEntry[]>;
  'memory.code_knowledge': (args: { text: string; limit?: number }) => Promise<MemoryRecord[]>;
  'memory.decisions': (args: { text: string; limit?: number }) => Promise<MemoryRecord[]>;
  'memory.patterns': (args: { text: string; limit?: number }) => Promise<MemoryRecord[]>;
};

const guard =
  <Args extends unknown[], R>({
    name,
    allow,
    fn,
  }: {
    name: ToolName;
    allow: readonly ToolName[];
    fn: (...args: Args) => R;
  }) =>
  (...args: Args): R => {
    if (!allow.includes(name)) {
      throw new Error(`Tool "${name}" is not in the agent's allowlist [${allow.join(', ')}]`);
    }
    return fn(...args);
  };

/**
 * Resolve the agent's allowlist into callable tools bound to a {@link RunContext}.
 * Every tool in {@link ALL_TOOLS} is present, but invoking one outside `allow`
 * throws — so the allowlist is enforced at call time, not merely advisory.
 */
export const createToolset = ({
  allow,
  context,
}: {
  allow: readonly ToolName[];
  context: RunContext;
}): Toolset => {
  assertKnownTools({ tools: allow });
  const queryMemory =
    (collection: 'code_knowledge' | 'decisions' | 'patterns') =>
    (args: { text: string; limit?: number }) =>
      context.memory.query({ collection, ...args });
  return {
    read: guard({ name: 'read', allow, fn: context.repo.read }),
    grep: guard({ name: 'grep', allow, fn: context.repo.grep }),
    list: guard({ name: 'list', allow, fn: context.repo.list }),
    'memory.code_knowledge': guard({
      name: 'memory.code_knowledge',
      allow,
      fn: queryMemory('code_knowledge'),
    }),
    'memory.decisions': guard({
      name: 'memory.decisions',
      allow,
      fn: queryMemory('decisions'),
    }),
    'memory.patterns': guard({
      name: 'memory.patterns',
      allow,
      fn: queryMemory('patterns'),
    }),
  };
};
