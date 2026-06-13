const workRoot = '/work';

export const rejectsTraversal = ({ path }: { path: string }): void => {
  if (path.split('/').some((segment) => segment === '..')) {
    throw new Error(`sandbox: refusing path containing '..': ${path}`);
  }
};

const stripLeadingSlash = ({ path }: { path: string }): string =>
  path.startsWith('/') ? path.replace(/^\/+/, '') : path;

export const toContainerPath = ({ path }: { path: string }): string => {
  rejectsTraversal({ path });
  const relative = stripLeadingSlash({ path });
  return relative === '' ? workRoot : `${workRoot}/${relative}`;
};
