import type {
  RepoAccess,
  RepoFileEntry,
  RepoGrepMatch,
  SandboxCheckout,
  SandboxRunner,
} from '../ports/index.js';

export type SandboxSeed = {
  files?: Record<string, string>;
};

const buildAccess = ({ files }: { files: Record<string, string> }): RepoAccess => ({
  read: async ({ path }) => {
    const content = files[path];
    if (content === undefined) {
      throw new Error(`mockSandbox: no file seeded at ${path}`);
    }
    return content;
  },
  grep: async ({ pattern, include }) => {
    const regex = new RegExp(pattern);
    const candidates = Object.entries(files).filter(([path]) =>
      include === undefined ? true : include.some((glob) => path.startsWith(glob)),
    );
    return candidates.reduce<RepoGrepMatch[]>((matches, [file, content]) => {
      const lineMatches = content
        .split('\n')
        .map((text, index) => ({ text, line: index + 1 }))
        .filter((entry) => regex.test(entry.text))
        .map((entry) => ({ file, line: entry.line, text: entry.text }));
      return [...matches, ...lineMatches];
    }, []);
  },
  list: async ({ dir }) =>
    Object.entries(files)
      .filter(([path]) => path.startsWith(dir))
      .map<RepoFileEntry>(([path, content]) => ({ path, size: content.length })),
});

export const mockSandbox = ({ seed }: { seed?: SandboxSeed } = {}): SandboxRunner => {
  const access = buildAccess({ files: seed?.files ?? {} });
  return {
    clone: async ({ ref }): Promise<SandboxCheckout> => ({ ref, access }),
    teardown: async () => {},
  };
};
